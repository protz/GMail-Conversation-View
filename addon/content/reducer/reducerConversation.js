/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/**
 * This reducer is for managing the control flow of loading and updating a
 * conversation.
 */

import * as RTK from "@reduxjs/toolkit";
import { composeSlice } from "./reducerCompose.js";
import { controllerActions } from "./controllerActions.js";
import { mergeContactDetails } from "./contacts.js";
import { messageActions } from "./reducerMessages.js";
import { MessageEnricher } from "./messageEnricher.js";
import { quickReplySlice } from "./reducerQuickReply.js";
import { summaryActions } from "./reducerSummary.js";

export const initialConversation = {
  currentId: 0,
};

let currentQueryListener;
let currentQueryListenerArgs;

function removeListeners() {
  if (currentQueryListener) {
    browser.convGloda.queryConversationMessages.removeListener(
      currentQueryListener,
      currentQueryListenerArgs
    );
    currentQueryListener = null;
    currentQueryListenerArgs = null;
  }
}

window.addEventListener("unload", () => {
  console.log("unload!");
  removeListeners();
}, { once : true });

export const conversationActions = {
  showConversation({ msgIds }) {
    console.trace();
    return async (dispatch, getState) => {
      let loadingStartedTime = Date.now();

      console.log("remove");
      removeListeners();

      let currentId = getState().conversation.currentId + 1;
      await dispatch(conversationActions.setConversationId({ currentId }));

      currentQueryListener = (event) => {
        console.log(event);
      };
      currentQueryListenerArgs = msgIds;

      console.log("add");
      browser.convGloda.queryConversationMessages.addListener(
        currentQueryListener,
        currentQueryListenerArgs
      );

      let messages = msgIds.map((id) => {
        return {
          id,
          attachments: {},
          initialPosition: 0,
          type: "",
          messageHeaderId: id,
          // TODO: only turn this on for non-gloda.
          getFullRequired: true,
          glodaMessageId: null,
          detailsShowing: false,
          recipientsIncludeLists: false,
          snippet: "",
        };
      });

      // TODO: eliminate the need?
      let mode = "replaceAll";
      let summary = { initialSet: msgIds };
      let currentState = getState();
      // The messages need some more filling out and tweaking.
      let messageEnricher = new MessageEnricher();
      let enrichedMsgs = await messageEnricher.enrich(
        mode,
        messages,
        currentState.summary,
        mode == "replaceAll"
          ? summary.initialSet
          : currentState.summary.initialSet
      );

      // The messages inside `msgData` don't come with filled in `to`/`from`/ect. fields.
      // We need to fill them in ourselves.
      await mergeContactDetails(enrichedMsgs);

      await dispatch(composeSlice.actions.resetStore());
      await dispatch(
        quickReplySlice.actions.setExpandedState({ expanded: false })
      );

      summary.loading = false;
      summary.subject = enrichedMsgs[enrichedMsgs.length - 1]?.subject;

      await dispatch(summaryActions.replaceSummaryDetails(summary));

      await dispatch(
        messageActions.updateConversation({ messages: enrichedMsgs, mode })
      );

      if (mode == "replaceAll") {
        if (currentState.summary.prefs.loggingEnabled) {
          console.debug(
            "Conversations:",
            "Load took (ms):",
            Date.now() - loadingStartedTime
          );
        }
        // TODO: Fix this for the standalone message view, so that we send
        // the correct notifications.
        if (!currentState.summary.isInTab) {
          await browser.convMsgWindow.fireLoadCompleted();
        }
        await dispatch(controllerActions.maybeSetMarkAsRead());
      }
    };
  },
};

export const conversationSlice = RTK.createSlice({
  name: "conversation",
  initialState: initialConversation,
  reducers: {
    setConversationId(state, { payload }) {
      return { ...state, currentId: payload.currentId };
    },
  },
});

Object.assign(conversationActions, conversationSlice.actions);
