/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { createFakeData, createFakeSummaryData } from "./utils.js";
import { jest } from "@jest/globals";
import { MessageEnricher } from "../content/reducer/messageEnricher.js";

describe("messageEnricher", () => {
  let fakeMessageHeaderData;
  let mailTabsGetSpy;
  let messageEnricher;

  beforeEach(() => {
    messageEnricher = new MessageEnricher();
    fakeMessageHeaderData = new Map();
    jest
      .spyOn(browser.messages, "get")
      .mockImplementation(async (id) => fakeMessageHeaderData.get(id));
    mailTabsGetSpy = jest.spyOn(browser.mailTabs, "get");
    let originalConsoleError = console.error;
    // We expect some errors due to how the tests are run with single messages
    // only.
    jest.spyOn(console, "error").mockImplementation((...args) => {
      if (
        !args[0].includes("kScrollSelected && didn't find the selected message")
      ) {
        originalConsoleError(...args);
      }
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("Header Details", () => {
    test("Fills out the message with details from the header", async () => {
      let fakeMsg = createFakeData({}, fakeMessageHeaderData);

      let msgs = await messageEnricher.enrich(
        [fakeMsg],
        createFakeSummaryData({ noFriendlyDate: true }),
        [fakeMessageHeaderData.size - 1]
      );

      expect(msgs[0]).toMatchObject({
        folderName: "Fake/Inbox",
        inView: true,
        isDraft: false,
        isJunk: false,
        isOutbox: false,
        read: false,
        shortFolderName: "Inbox",
        subject: "Fake Msg",
        starred: false,
        tags: [],
      });
    });

    test("Marks as not in view if the message is not in the selected view nor folder", async () => {
      let fakeMsg = createFakeData({}, fakeMessageHeaderData);

      let msgs = await messageEnricher.enrich(
        [fakeMsg],
        createFakeSummaryData({ noFriendlyDate: true }),
        []
      );

      expect(msgs[0]).toMatchObject({
        inView: false,
      });
    });

    test("Marks as in view if the message is not selected but in the same folder", async () => {
      let fakeMsg = createFakeData({}, fakeMessageHeaderData);
      mailTabsGetSpy.mockReturnValue({
        displayedFolder: {
          accountId: "id1",
          path: "Inbox",
        },
      });

      let msgs = await messageEnricher.enrich(
        [fakeMsg],
        createFakeSummaryData({ noFriendlyDate: true }),
        []
      );

      expect(msgs[0]).toMatchObject({
        inView: true,
      });
    });

    test("Fills out folder name", async () => {
      let fakeMsg = createFakeData({}, fakeMessageHeaderData);
      let msgs = await messageEnricher.enrich(
        [fakeMsg],
        createFakeSummaryData({ noFriendlyDate: true }),
        [fakeMessageHeaderData.size]
      );

      expect(msgs[0]).toMatchObject({
        folderName: "Fake/Inbox",
        shortFolderName: "Inbox",
      });
    });

    test("Correctly sets flags with details from the header", async () => {
      let tests = [
        {
          source: {
            id: 1,
            folderType: "drafts",
            folderName: "Drafts",
            read: true,
            subject: "A draft",
            flagged: true,
          },
          expected: {
            isDraft: true,
            isJunk: false,
            isOutbox: false,
            read: true,
            shortFolderName: "Drafts",
            folderName: "Fake/Drafts",
            subject: "A draft",
            starred: true,
            tags: [],
          },
        },
        {
          source: {
            id: 2,
            folderType: "outbox",
            folderName: "Outbox",
          },
          expected: {
            isDraft: false,
            isJunk: false,
            isOutbox: true,
            folderName: "Fake/Outbox",
            shortFolderName: "Outbox",
          },
        },
        {
          source: {
            id: 3,
            folderType: "inbox",
            junk: true,
          },
          expected: {
            isDraft: false,
            isJunk: true,
            isOutbox: false,
          },
        },
        {
          source: {
            id: 4,
            folderType: "templates",
            folderName: "Templates",
          },
          expected: {
            isDraft: false,
            isJunk: false,
            isOutbox: false,
            isTemplate: true,
            folderName: "Fake/Templates",
            shortFolderName: "Templates",
          },
        },
      ];

      mailTabsGetSpy.mockReturnValue(false);

      for (let test of tests) {
        let fakeMsg = createFakeData(test.source, fakeMessageHeaderData);

        let msgs = await messageEnricher.enrich(
          [fakeMsg],
          createFakeSummaryData({ noFriendlyDate: true }),
          [3]
        );

        expect(msgs[0]).toMatchObject(test.expected);
      }
    });

    test("Obtains the informaiton for tags", async () => {
      let fakeMsg = createFakeData(
        {
          tags: ["$label1", "$label3"],
        },
        fakeMessageHeaderData
      );

      let msgs = await messageEnricher.enrich(
        [fakeMsg],
        createFakeSummaryData({ noFriendlyDate: true }),
        [fakeMessageHeaderData.size - 1]
      );

      expect(msgs[0]).toMatchObject({
        tags: [
          {
            color: "#ff2600",
            key: "$label1",
            name: "Important",
          },
          {
            color: "#009900",
            key: "$label3",
            name: "Personal",
          },
        ],
      });
    });
  });

  describe("De-duplicates messages when they have the same ids", () => {
    test("Prefers in-view messages", async () => {
      let fakeMsgs = [
        createFakeData(
          { id: 1, folderType: "trash", headerMessageId: 1 },
          fakeMessageHeaderData
        ),
        createFakeData(
          { id: 2, folderType: "archives", headerMessageId: 1 },
          fakeMessageHeaderData
        ),
        createFakeData(
          { id: 3, folderType: "sent", headerMessageId: 1 },
          fakeMessageHeaderData
        ),
        createFakeData(
          { id: 4, folderType: "inbox", headerMessageId: 1 },
          fakeMessageHeaderData
        ),
        createFakeData(
          { id: 5, folderType: "junk", folderName: "Junk", headerMessageId: 1 },
          fakeMessageHeaderData
        ),
      ];
      mailTabsGetSpy.mockReturnValue({
        displayedFolder: {
          accountId: "id1",
          path: "Junk",
        },
      });

      let msgs = await messageEnricher.enrich(
        fakeMsgs,
        createFakeSummaryData({ expandWho: 3 }),
        []
      );
      messageEnricher.determineExpansion(msgs, 3, []);

      expect(msgs.length).toBe(1);
      expect(msgs[0].id).toBe(5);
    });

    test("Next messages in inbox", async () => {
      let fakeMsgs = [
        createFakeData(
          { id: 1, folderType: "trash", headerMessageId: 1 },
          fakeMessageHeaderData
        ),
        createFakeData(
          { id: 2, folderType: "archives", headerMessageId: 1 },
          fakeMessageHeaderData
        ),
        createFakeData(
          { id: 3, folderType: "sent", headerMessageId: 1 },
          fakeMessageHeaderData
        ),
        createFakeData(
          { id: 4, folderType: "inbox", headerMessageId: 1 },
          fakeMessageHeaderData
        ),
      ];

      let msgs = await messageEnricher.enrich(
        fakeMsgs,
        createFakeSummaryData({ expandWho: 3 }),
        []
      );
      messageEnricher.determineExpansion(msgs, 3, []);

      expect(msgs.length).toBe(1);
      expect(msgs[0].id).toBe(4);
    });

    test("Next messages in sent", async () => {
      let fakeMsgs = [
        createFakeData(
          { id: 1, folderType: "trash", headerMessageId: 1 },
          fakeMessageHeaderData
        ),
        createFakeData(
          { id: 2, folderType: "archives", headerMessageId: 1 },
          fakeMessageHeaderData
        ),
        createFakeData(
          { id: 3, folderType: "sent", headerMessageId: 1 },
          fakeMessageHeaderData
        ),
      ];

      let msgs = await messageEnricher.enrich(
        fakeMsgs,
        createFakeSummaryData({ expandWho: 3 }),
        []
      );
      messageEnricher.determineExpansion(msgs, 3, []);

      expect(msgs.length).toBe(1);
      expect(msgs[0].id).toBe(3);
    });

    test("Next messages in archives", async () => {
      let fakeMsgs = [
        createFakeData(
          { id: 1, folderType: "trash", headerMessageId: 1 },
          fakeMessageHeaderData
        ),
        createFakeData(
          { id: 2, folderType: "archives", headerMessageId: 1 },
          fakeMessageHeaderData
        ),
      ];

      let msgs = await messageEnricher.enrich(
        fakeMsgs,
        createFakeSummaryData({ expandWho: 3 }),
        []
      );
      messageEnricher.determineExpansion(msgs, 3, []);

      expect(msgs.length).toBe(1);
      expect(msgs[0].id).toBe(2);
    });

    test("Lastly, the first of other messages", async () => {
      let fakeMsgs = [
        createFakeData(
          { id: 1, folderType: "trash", headerMessageId: 1 },
          fakeMessageHeaderData
        ),
        createFakeData(
          { id: 2, folderType: "junk", headerMessageId: 1 },
          fakeMessageHeaderData
        ),
      ];

      let msgs = await messageEnricher.enrich(
        fakeMsgs,
        createFakeSummaryData({ expandWho: 3 }),
        []
      );
      messageEnricher.determineExpansion(msgs, 3, []);

      expect(msgs.length).toBe(1);
      expect(msgs[0].id).toBe(1);
    });
  });

  describe("Expansion and Scroll To", () => {
    test("Expands all messages when expand is set to all", async () => {
      let fakeMsgs = [];
      for (let i = 0; i < 5; i++) {
        fakeMsgs.push(createFakeData({ id: i }, fakeMessageHeaderData));
      }

      let msgs = await messageEnricher.enrich(
        fakeMsgs,
        createFakeSummaryData({ expandWho: 3 }),
        [fakeMessageHeaderData.size - 1]
      );
      messageEnricher.determineExpansion(msgs, 3, [
        fakeMessageHeaderData.size - 1,
      ]);

      for (let i = 0; i < 5; i++) {
        expect(msgs[i].expanded).toBe(true);
        if (i < 4) {
          expect("scrollTo" in fakeMsgs[i]).toBe(false);
        } else {
          expect(msgs[i].scrollTo).toBe(true);
        }
      }
    });

    test("Expands no messages when expand is set to none", async () => {
      let fakeMsgs = [];
      for (let i = 0; i < 5; i++) {
        fakeMsgs.push(createFakeData({ id: i }, fakeMessageHeaderData));
      }

      let msgs = await messageEnricher.enrich(
        fakeMsgs,
        createFakeSummaryData({ expandWho: 1 }),
        [fakeMessageHeaderData.size - 1]
      );
      messageEnricher.determineExpansion(msgs, 1, [
        fakeMessageHeaderData.size - 1,
      ]);

      for (let i = 0; i < 5; i++) {
        expect(msgs[i].expanded).toBe(false);
        if (i < 4) {
          expect("scrollTo" in msgs[i]).toBe(false);
        } else {
          expect(msgs[i].scrollTo).toBe(true);
        }
      }
    });

    describe("Expansion Auto", () => {
      test("Single, all read - expand and select selection", async () => {
        let fakeMsgs = [];
        for (let i = 0; i < 5; i++) {
          fakeMsgs.push(
            createFakeData({ id: i, read: true }, fakeMessageHeaderData)
          );
        }

        let msgs = await messageEnricher.enrich(
          fakeMsgs,
          createFakeSummaryData(),
          [3]
        );
        messageEnricher.determineExpansion(msgs, 4, [3]);

        for (let i = 0; i < 5; i++) {
          expect(msgs[i].expanded).toBe(i == 3);
          if (i != 3) {
            expect("scrollTo" in msgs[i]).toBe(false);
          } else {
            expect(msgs[i].scrollTo).toBe(true);
          }
        }
      });

      test("Single, multi unread  - expand single and scroll it", async () => {
        let fakeMsgs = [];
        for (let i = 0; i < 5; i++) {
          fakeMsgs.push(
            createFakeData({ id: i, read: i <= 2 }, fakeMessageHeaderData)
          );
        }

        let msgs = await messageEnricher.enrich(
          fakeMsgs,
          createFakeSummaryData(),
          [3]
        );
        messageEnricher.determineExpansion(msgs, 4, [3]);

        for (let i = 0; i < 5; i++) {
          expect(msgs[i].expanded).toBe(i == 3);
          if (i != 3) {
            expect("scrollTo" in msgs[i]).toBe(false);
          } else {
            expect(msgs[i].scrollTo).toBe(true);
          }
        }
      });

      test("Multi, unread - expand unread, select first", async () => {
        let fakeMsgs = [];
        for (let i = 0; i < 5; i++) {
          fakeMsgs.push(
            createFakeData({ id: i, read: i <= 2 }, fakeMessageHeaderData)
          );
        }

        let msgs = await messageEnricher.enrich(
          fakeMsgs,
          createFakeSummaryData(),
          [3, 4]
        );
        messageEnricher.determineExpansion(msgs, 4, [3, 4]);

        for (let i = 0; i < 5; i++) {
          expect(msgs[i].expanded).toBe(i > 2);
          // Should have selected the first unread.
          if (i != 3) {
            expect("scrollTo" in msgs[i]).toBe(false);
          } else {
            expect(msgs[i].scrollTo).toBe(true);
          }
        }
      });
    });
  });

  describe("Attachments", () => {
    test("Extends the information for attachments", async () => {
      let fakeMsg = createFakeData(
        {
          attachments: [
            {
              contentType: "application/pdf",
              name: "foo.pdf",
              partName: "1.2",
              size: 634031,
            },
          ],
        },
        fakeMessageHeaderData
      );

      let msgs = await messageEnricher.enrich(
        [fakeMsg],
        createFakeSummaryData({ noFriendlyDate: true }),
        [fakeMessageHeaderData.size - 1]
      );

      expect(msgs[0]).toMatchObject({
        attachments: [
          {
            anchor: "msg0att0",
            contentType: "application/pdf",
            formattedSize: "634031 bars",
            name: "foo.pdf",
            partName: "1.2",
            size: 634031,
          },
        ],
      });
    });
  });

  describe("getFullDetails", () => {
    test("Adjusts the from lines for Bugzilla messages", async () => {
      jest.spyOn(browser.messages, "getFull").mockReturnValue({
        headers: {
          "x-bugzilla-who": ["actualFrom@invalid.com"],
        },
        parts: [
          {
            contentType: "text/plain",
            body: "should be used",
          },
        ],
      });
      jest
        .spyOn(browser.conversations, "parseMimeLine")
        .mockImplementation((line) => [
          {
            email: line,
            name: "-",
            fullName: "-",
          },
        ]);

      let fakeMsg = createFakeData(
        {
          snippet: "should not be used",
          getFullRequired: true,
          author: "realEmail@invalid.com",
        },
        fakeMessageHeaderData
      );

      let msgs = await messageEnricher.enrich(
        [fakeMsg],
        createFakeSummaryData(),
        [fakeMessageHeaderData.size - 1]
      );
      expect(msgs[0].parsedLines.from[0].email).toBe("actualFrom@invalid.com");
      expect(msgs[0].realFrom).toBe("realEmail@invalid.com");
    });

    test("Parse reply-to header", async () => {
      jest.spyOn(browser.messages, "getFull").mockReturnValue({
        headers: {
          "reply-to": ["actualFrom@invalid.com"],
        },
        parts: [
          {
            contentType: "text/plain",
            body: "should be used",
          },
        ],
      });
      jest
        .spyOn(browser.conversations, "parseMimeLine")
        .mockImplementation((line) => [
          {
            email: line,
            name: "-",
            fullName: "-",
          },
        ]);

      let fakeMsg = createFakeData(
        {
          snippet: "should not be used",
          getFullRequired: true,
          author: "listEmail@invalid.com",
        },
        fakeMessageHeaderData
      );

      let msgs = await messageEnricher.enrich(
        [fakeMsg],
        createFakeSummaryData(),
        [fakeMessageHeaderData.size - 1]
      );
      expect(msgs[0].replyTo).toStrictEqual([
        {
          email: "actualFrom@invalid.com",
          name: "-",
          fullName: "-",
        },
      ]);
    });
  });

  describe("Snippets", () => {
    test("Adjusts the snippet for better output from bugzilla", async () => {
      const msgSnippets = [
        {
          actual: "My message snippet",
          expected: "My message snippet",
        },
        {
          actual:
            "https://bugzilla.mozilla.org/show_bug.cgi?id=1199577\n\nSausages <sausages@example.com> changed:\n",
          expected: "\n\nSausages <sausages@example.com> changed:\n",
        },
        {
          actual: `https://bugzilla.mozilla.org/show_bug.cgi?id=1712565

Petruta Horea [:phorea] <petruta.rasa@softvision.com> changed:

           What    |Removed                     |Added
----------------------------------------------------------------------------
             Status|RESOLVED                    |VERIFIED
   status-firefox91|fixed                       |verified

--- Comment #5 from Petruta Horea [:phorea] <petruta.rasa@softvision.com> 2021-06-03 11:25:00 BST ---
Updating`,
          expected: "\nUpdating",
        },
      ];
      const fakeMsgs = msgSnippets.map((snippet, index) =>
        createFakeData(
          {
            id: index + 1,
            snippet: snippet.actual,
            type: "bugzilla",
          },
          fakeMessageHeaderData
        )
      );
      let msgs = await messageEnricher.enrich(
        fakeMsgs,
        createFakeSummaryData(),
        [fakeMessageHeaderData.size - 1]
      );

      for (let [i, fakeMsg] of msgs.entries()) {
        expect(fakeMsg.snippet).toBe(msgSnippets[i].expected);
      }
    });

    test("Uses the snippet from getFull if getting full message (text)", async () => {
      jest.spyOn(browser.messages, "getFull").mockReturnValue({
        headers: [],
        parts: [
          {
            contentType: "text/plain",
            body: "should be used",
          },
        ],
      });

      let fakeMsg = createFakeData(
        { snippet: "should not be used", getFullRequired: true },
        fakeMessageHeaderData
      );

      let msgs = await messageEnricher.enrich(
        [fakeMsg],
        createFakeSummaryData(),
        [fakeMessageHeaderData.size - 1]
      );

      expect(msgs[0].snippet).toBe("should be used");
    });

    test("Uses the snippet from getFull if getting full message (html)", async () => {
      jest.spyOn(browser.messages, "getFull").mockReturnValue({
        headers: [],
        parts: [
          {
            contentType: "text/html",
            body: "should not be used (html is translated to plain)",
          },
        ],
      });

      let fakeMsg = createFakeData(
        { snippet: "should not be used", getFullRequired: true },
        fakeMessageHeaderData
      );

      let msgs = await messageEnricher.enrich(
        [fakeMsg],
        createFakeSummaryData(),
        [fakeMessageHeaderData.size - 1]
      );

      expect(msgs[0].snippet).toBe("short snippet");
    });
  });

  describe("Dates", () => {
    test("Sets the dates for displaying friendly dates", async () => {
      let now = new Date();
      let fakeMsg = createFakeData({ date: now }, fakeMessageHeaderData);

      let msgs = await messageEnricher.enrich(
        [fakeMsg],
        createFakeSummaryData(),
        [fakeMessageHeaderData.size - 1]
      );

      expect(msgs[0].date).toBe("yesterday");
      expect(msgs[0].fullDate).toBe(
        new Intl.DateTimeFormat(undefined, {
          timeStyle: "short",
        }).format(now)
      );
    });

    test("Sets the dates for not displaying friendly dates", async () => {
      let now = new Date();
      let fakeMsg = createFakeData({ date: now }, fakeMessageHeaderData);

      let msgs = await messageEnricher.enrich(
        [fakeMsg],
        createFakeSummaryData({ noFriendlyDate: true }),
        [fakeMessageHeaderData.size - 1]
      );

      expect(msgs[0].date).toBe(
        new Intl.DateTimeFormat(undefined, {
          timeStyle: "short",
        }).format(now)
      );
      expect(msgs[0].fullDate).toBe("");
    });
  });
});
