/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */
/* eslint-env jest */

import { jest } from "@jest/globals";
// This is so that utils.js defines fetch onto the global scope.
// eslint-disable-next-line no-unused-vars
import { enzyme } from "./utils.js";
import { UIHandler } from "../background/uiHandler.js";

describe("getDefaultIdentity", () => {
  let uiHandler;

  beforeEach(() => {
    uiHandler = new UIHandler();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("should get the default identity", async () => {
    let defaultId = await uiHandler.getDefaultIdentity();

    expect(defaultId).toStrictEqual(["ac1", "id3"]);
  });

  test("should get the default identity with different setup", async () => {
    jest.spyOn(browser.accounts, "list").mockImplementation(async () => {
      return [
        {
          id: "ac5",
          identities: [
            {
              id: `id5`,
              email: `id5@example.com`,
            },
          ],
        },
      ];
    });
    let defaultId = await uiHandler.getDefaultIdentity();

    expect(defaultId).toStrictEqual(["ac5", "id5"]);
  });
});

describe("openQuickCompose", () => {
  let uiHandler;
  let mockedTabCreate;
  let mockedWindowCreate;

  beforeEach(() => {
    mockedTabCreate = jest.spyOn(browser.tabs, "create");
    mockedWindowCreate = jest.spyOn(browser.windows, "create");
  });

  beforeEach(() => {
    uiHandler = new UIHandler();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test("should use the default identity if not a normal window", async () => {
    jest.spyOn(browser.windows, "getCurrent").mockImplementation(async () => {
      return {
        focused: true,
        id: "2",
        type: "popup",
      };
    });

    await uiHandler.openQuickCompose();

    expect(mockedTabCreate).toHaveBeenCalledWith({
      url: "compose/compose.html?accountId=ac1&identityId=id3",
    });
    expect(mockedWindowCreate).not.toHaveBeenCalled();
  });

  test("should open a window if set in preferences", async () => {
    jest.spyOn(browser.windows, "getCurrent").mockImplementation(async () => {
      return {
        focused: true,
        id: "2",
        type: "popup",
      };
    });

    let oldValue = await browser.storage.local.get("preferences");
    let newValue = {
      preferences: { ...oldValue.preferences, compose_in_tab: false },
    };
    await browser.storage.local.set(newValue);

    await uiHandler.openQuickCompose();

    expect(mockedTabCreate).not.toHaveBeenCalled();
    expect(mockedWindowCreate).toHaveBeenCalledWith({
      url: "compose/compose.html?accountId=ac1&identityId=id3",
      type: "popup",
      width: 1024,
      height: 600,
    });

    await browser.storage.local.set(oldValue);
  });

  test("should use the id of the displayed message", async () => {
    await uiHandler.openQuickCompose();

    expect(mockedTabCreate).toHaveBeenCalledWith({
      url: "compose/compose.html?accountId=ac34&identityId=idac34",
    });
    expect(mockedWindowCreate).not.toHaveBeenCalled();
  });
});
