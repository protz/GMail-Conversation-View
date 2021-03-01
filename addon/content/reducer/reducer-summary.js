/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/* global Conversations, getMail3Pane, topMail3Pane, printConversation */
import * as RTK from "@reduxjs/toolkit";
import { messageActions } from "./reducer-messages.js";

const initialSummary = {
  browserForegroundColor: "#000000",
  browserBackgroundColor: "#FFFFFF",
  conversation: null,
  defaultFontSize: 15,
  hasBuiltInPdf: false,
  hasIdentityParamsForCompose: false,
  hideQuickReply: false,
  iframesLoading: 0,
  isInTab: false,
  // TODO: What is loading used for?
  loading: true,
  OS: "win",
  tabId: null,
  tenPxFactor: 0.7,
  subject: "",
  windowId: null,
  defaultDetailsShowing: false,
};

async function handleShowDetails(messages, state, dispatch, updateFn) {
  let defaultShowing = state.summary.defaultDetailsShowing;
  for (let msg of messages.msgData) {
    msg.detailsShowing = defaultShowing;
  }

  await updateFn();

  if (defaultShowing) {
    for (let msg of state.messages.msgData) {
      await dispatch(
        messageActions.showMsgDetails({
          id: msg.id,
          detailsShowing: true,
        })
      );
    }
  }
}

export const summaryActions = {
  replaceConversation({ summary, messages }) {
    return async (dispatch, getState) => {
      await handleShowDetails(messages, getState(), dispatch, () => {
        dispatch(summarySlice.actions.replaceSummaryDetails(summary));
        return dispatch(
          messageActions.replaceConversationDetails({
            messages,
          })
        );
      });
    };
  },
  appendMessages({ summary, messages }) {
    return async (dispatch, getState) => {
      await handleShowDetails(messages, getState(), dispatch, () => {
        return dispatch(messageActions.appendMessages({ messages }));
      });
    };
  },
  showMessagesInvolving({ name, email }) {
    return async (dispatch, getState) => {
      await browser.convContacts
        .showMessagesInvolving({
          email,
          title: browser.i18n.getMessage("involvingTabTitle", [name]),
          windowId: getState().summary.windowId,
        })
        .catch(console.error);
    };
  },
  sendEmail({ name, email }) {
    return async (dispatch, getState) => {
      let state = getState();
      let dest = await browser.convContacts.makeMimeAddress({
        name,
        email,
      });
      if (state.summary.hasIdentityParamsForCompose) {
        // Ideally we should use the displayed folder, but the displayed message
        // works fine, as we'll only
        let folder = await browser.convMsgWindow.getDisplayedFolder(
          state.summary.tabId
        );
        let account = await browser.accounts.get(folder.accountId);
        await browser.compose.beginNew({
          identityId: account.identities[0].id,
          to: dest,
        });
      } else {
        await browser.convContacts
          .composeNew({ to: dest })
          .catch(console.error);
      }
    };
  },
  createFilter({ email }) {
    return async (dispatch, getState) => {
      browser.conversations
        .createFilter(email, getState().summary.windowId)
        .catch(console.error);
    };
  },
  copyEmail({ email }) {
    return () => {
      navigator.clipboard.writeText(email);
    };
  },
  editContact({ email }) {
    return () => {
      browser.convContacts.beginEdit({
        email,
      });
    };
  },
  addContact({ email, name }) {
    return () => {
      browser.convContacts.beginNew({
        email,
        displayName: name,
      });
      // TODO: In theory we should be updating the store so that the button can
      // then be updated to indicate this is now in the address book. However,
      // until we start getting the full conversation messages hooked up, this
      // won't be easy. As this is only a small bit of hidden UI, we can punt on
      // this for now.
    };
  },
  openLink({ url }) {
    return () => {
      if ("openDefaultBrowser" in browser.windows) {
        browser.windows.openDefaultBrowser(url);
      } else {
        getMail3Pane().messenger.launchExternalURL(url);
      }
    };
  },
  printConversation() {
    return () => {
      // TODO: Fix printing
      printConversation();
    };
  },
  forwardConversation() {
    return async () => {
      try {
        await Conversations.currentConversation.forward();
      } catch (e) {
        console.error(e);
      }
    };
  },
  msgStreamLoadFinished({ dueToExpansion, msgUri, iframe }) {
    return async (dispatch, getState) => {
      if (!dueToExpansion) {
        dispatch(summarySlice.actions.decIframesLoading());
      }
      // It might be that we're trying to send a message on unmount, but the
      // conversation/message has gone away. If that's the case, we just skip
      // and move on.
      const { summary } = getState();
      if (summary.conversation?.getMessage) {
        const msg = summary.conversation.getMessage(msgUri);
        if (msg) {
          msg.postStreamMessage(topMail3Pane(window), iframe);
        }
      }
    };
  },
  msgStreamMsg({ dueToExpansion, msgUri, docshell }) {
    return async (dispatch, getState) => {
      if (!dueToExpansion) {
        dispatch(summarySlice.actions.incIframesLoading());
      }
      const { summary } = getState();
      let message = summary.conversation.getMessage(msgUri);
      // The message might not be found, if so it has probably been deleted from
      // under us, so just continue and not blow up.
      if (message) {
        message.streamMessage(topMail3Pane(window).msgWindow, docshell);
      } else {
        console.warn("Could not find message for streaming", msgUri);
      }
    };
  },
};

export const summarySlice = RTK.createSlice({
  name: "summary",
  initialState: initialSummary,
  reducers: {
    incIframesLoading(state) {
      return { ...state, iframesLoading: state.iframesLoading + 1 };
    },
    decIframesLoading(state) {
      return {
        ...state,
        // Never decrement below zero
        iframesLoading: Math.max(state.iframesLoading - 1, 0),
      };
    },
    setConversationState(state, { payload }) {
      const { isInTab, tabId, windowId } = payload;
      return { ...state, isInTab, tabId, windowId };
    },
    setSystemOptions(state, { payload }) {
      const {
        OS,
        browserForegroundColor,
        browserBackgroundColor,
        defaultFontSize,
        defaultDetailsShowing,
        browserVersion,
        hideQuickReply,
      } = payload;
      let tenPxFactor = 0.625;
      if (OS == "mac") {
        tenPxFactor = 0.666;
      } else if (OS == "win") {
        tenPxFactor = 0.7;
      }

      let [mainVersion, minorVersion] = browserVersion?.split(".");

      return {
        ...state,
        browserForegroundColor,
        browserBackgroundColor,
        defaultFontSize,
        defaultDetailsShowing,
        // Thunderbird 81 has built-in PDF viewer.
        hasBuiltInPdf: mainVersion >= 81,
        hasIdentityParamsForCompose:
          mainVersion > 78 || (mainVersion == 78 && minorVersion >= 6),
        hideQuickReply,
        OS,
        tenPxFactor,
      };
    },
    replaceSummaryDetails(state, { payload }) {
      if (payload) {
        return { ...state, ...payload };
      }
      return state;
    },
  },
});

// We don't really care about drawing a distinction between
// actions and thunks, so we make the actions and thunks
// available from the same object.
Object.assign(summaryActions, summarySlice.actions);

globalThis.conversationSummaryActions = summaryActions;
