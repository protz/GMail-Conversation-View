/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/* global Redux, Conversations, topMail3Pane, getMail3Pane,
          isInTab:true, openConversationInTabOrWindow,
          printConversation, ConversationUtils */

/* exported conversationApp */

"use strict";

const { XPCOMUtils } = ChromeUtils.import(
  "resource://gre/modules/XPCOMUtils.jsm"
);
XPCOMUtils.defineLazyModuleGetters(this, {
  ContactHelpers: "chrome://conversations/content/modules/contact.js",
  openConversationInTabOrWindow:
    "chrome://conversations/content/modules/misc.js",
  MessageUtils: "chrome://conversations/content/modules/message.js",
});

const initialAttachments = {};

const initialMessages = {
  msgData: [],
};

const initialSummary = {
  conversation: null,
  // TODO: What is loading used for?
  loading: true,
  iframesLoading: 0,
  subject: "",
};

function modifyOnlyMsg(currentState, msgUri, modifier) {
  const newState = { ...currentState };
  const newMsgData = [];
  for (let i = 0; i < currentState.msgData.length; i++) {
    if (currentState.msgData[i].msgUri == msgUri) {
      newMsgData.push(modifier({ ...currentState.msgData[i] }));
    } else {
      newMsgData.push(currentState.msgData[i]);
    }
  }
  newState.msgData = newMsgData;
  return newState;
}

function attachments(state = initialAttachments, action) {
  switch (action.type) {
    case "PREVIEW_ATTACHMENT": {
      if (action.maybeViewable) {
        // Can't use browser.tabs.create because imap://user@bar/ is an
        // illegal url.
        browser.conversations.createTab({
          url: action.url,
          type: "contentTab",
        });
      }
      if (action.isPdf) {
        browser.conversations.createTab({
          url:
            "chrome://conversations/content/pdfviewer/wrapper.xul?uri=" +
            encodeURIComponent(action.url) +
            "&name=" +
            encodeURIComponent(action.name),
          type: "chromeTab",
        });
      }
      return state;
    }
    case "DOWNLOAD_ALL": {
      MessageUtils.downloadAllAttachments(
        topMail3Pane(window),
        action.msgUri,
        action.attachmentDetails
      );
      return state;
    }
    case "DOWNLOAD_ATTACHMENT": {
      MessageUtils.downloadAttachment(
        topMail3Pane(window),
        action.msgUri,
        action.attachment
      );
      return state;
    }
    case "OPEN_ATTACHMENT": {
      MessageUtils.openAttachment(
        topMail3Pane(window),
        action.msgUri,
        action.attachment
      );
      return state;
    }
    case "DETACH_ATTACHMENT": {
      MessageUtils.detachAttachment(
        topMail3Pane(window),
        action.msgUri,
        action.attachment,
        action.shouldSave
      );
      return state;
    }
    case "SHOW_GALLERY_VIEW": {
      browser.tabs.create({
        url: "/gallery/index.html?uri=" + encodeURI(action.msgUri),
      });
      return state;
    }
    default: {
      return state;
    }
  }
}

/* eslint-disable-next-line complexity */
function messages(state = initialMessages, action) {
  switch (action.type) {
    case "REPLACE_CONVERSATION_DETAILS": {
      return {
        ...state,
        ...action.messages,
      };
    }
    case "EDIT_DRAFT": {
      MessageUtils.editDraft(
        topMail3Pane(window),
        action.msgUri,
        action.shiftKey
      );
      return state;
    }
    case "EDIT_AS_NEW": {
      MessageUtils.editAsNew(
        topMail3Pane(window),
        action.msgUri,
        action.shiftKey
      );
      return state;
    }
    case "MSG_REPLY": {
      MessageUtils.reply(topMail3Pane(window), action.msgUri, action.shiftKey);
      return state;
    }
    case "MSG_REPLY_ALL": {
      MessageUtils.replyAll(
        topMail3Pane(window),
        action.msgUri,
        action.shiftKey
      );
      return state;
    }
    case "MSG_REPLY_LIST": {
      MessageUtils.replyList(
        topMail3Pane(window),
        action.msgUri,
        action.shiftKey
      );
      return state;
    }
    case "MSG_FORWARD": {
      MessageUtils.forward(
        topMail3Pane(window),
        action.msgUri,
        action.shiftKey
      );
      return state;
    }
    case "MSG_ARCHIVE": {
      browser.messages.archive([action.id]).catch(console.error);
      return state;
    }
    case "MSG_DELETE": {
      browser.messages.delete([action.id]).catch(console.error);
      return state;
    }
    case "MSG_OPEN_CLASSIC": {
      MessageUtils.openInClassic(topMail3Pane(window), action.msgUri);
      return state;
    }
    case "MSG_OPEN_SOURCE": {
      MessageUtils.openInSourceView(topMail3Pane(window), action.msgUri);
      return state;
    }
    case "MSG_SET_TAGS": {
      browser.messages
        .update(action.id, {
          tags: action.tags.map(t => t.id),
        })
        .catch(console.error);
      return state;
    }
    case "MSG_TOGGLE_TAG_BY_INDEX": {
      browser.messages
        .listTags()
        .then(allTags => {
          const toggledTag = allTags[action.index];
          // Toggling a tag that is out of range does nothing.
          if (!toggledTag) {
            return null;
          }
          if (action.tags.find(tag => tag.key === toggledTag.key)) {
            return browser.messages.update(action.id, {
              tags: action.tags.filter(tag => tag.key !== toggledTag.key),
            });
          }

          return browser.messages.update(action.id, {
            tags: [...action.tags, toggledTag],
          });
        })
        .catch(console.error);
      return state;
    }
    case "MSG_STAR": {
      browser.messages
        .update(action.id, {
          flagged: action.star,
        })
        .catch(console.error);
      return state;
    }
    case "MSG_EXPAND": {
      return modifyOnlyMsg(state, action.msgUri, msg => {
        const newMsg = { ...msg };
        newMsg.expanded = action.expand;
        return newMsg;
      });
    }
    case "MSG_MARK_AS_READ": {
      const msg = Conversations.currentConversation.getMessage(action.msgUri);
      msg.read = true;
      return state;
    }
    case "MSG_SELECTED": {
      if (Conversations.currentConversation) {
        const msg = Conversations.currentConversation.getMessage(action.msgUri);
        if (msg) {
          msg.onSelected();
        }
      }
      return state;
    }
    case "TOGGLE_CONVERSATION_EXPANDED": {
      const newState = { ...state };
      const newMsgData = [];
      for (let msg of newState.msgData) {
        const newMsg = { ...msg, expanded: action.expand };
        newMsgData.push(newMsg);
      }
      newState.msgData = newMsgData;
      return newState;
    }
    case "TOGGLE_CONVERSATION_READ": {
      for (let msg of state.msgData) {
        browser.messages
          .update(msg.id, { read: action.read })
          .catch(console.error);
      }
      return state;
    }
    case "ARCHIVE_CONVERSATION": {
      ConversationUtils.archive(
        topMail3Pane(window),
        isInTab,
        state.msgData.map(msg => msg.msgUri)
      );
      return state;
    }
    case "DELETE_CONVERSATION": {
      const win = topMail3Pane(window);
      if (
        ConversationUtils.delete(
          win,
          isInTab,
          state.msgData.map(msg => msg.msgUri)
        )
      ) {
        ConversationUtils.closeTab(win, window.frameElement);
      }
      return state;
    }
    case "MSG_UPDATE_DATA": {
      return modifyOnlyMsg(state, action.msgData.msgUri, msg => {
        return { ...msg, ...action.msgData };
      });
    }
    case "MSG_UPDATE_SPECIAL_TAGS": {
      return modifyOnlyMsg(state, action.uri, msg => {
        const newSpecialTags = [...action.specialTags];
        return { ...msg, specialTags: newSpecialTags };
      });
    }
    case "MARK_AS_JUNK": {
      // This action should only be activated when the conversation is not a
      //  conversation in a tab AND there's only one message in the conversation,
      //  i.e. the currently selected message
      ConversationUtils.markAsJunk(topMail3Pane(window), action.isJunk);
      if (!action.isJunk) {
        // TODO: We should possibly wait until we get the notification before
        // clearing the state here.
        return modifyOnlyMsg(state, action.msgUri, msg => {
          const newMsg = { ...msg };
          newMsg.isJunk = action.isJunk;
          return newMsg;
        });
      }
      return state;
    }
    case "MSG_IGNORE_PHISHING": {
      MessageUtils.ignorePhishing(action.msgUri);
      return modifyOnlyMsg(state, action.msgUri, msg => {
        const newMsg = { ...msg };
        newMsg.isPhishing = false;
        return newMsg;
      });
    }
    case "MSG_CLICK_IFRAME": {
      // Hand this off to Thunderbird's content clicking algorithm as that's simplest.
      if (!topMail3Pane(window).contentAreaClick(action.event)) {
        action.event.preventDefault();
        action.event.stopPropagation();
      }
      return state;
    }
    case "MSG_SHOW_DETAILS": {
      const newState = { ...state };
      const newMsgData = [];
      for (let i = 0; i < state.msgData.length; i++) {
        if (state.msgData[i].msgUri == action.msgUri) {
          newMsgData.push({ ...state.msgData[i], detailsShowing: action.show });
          if (!newMsgData.hdrDetails) {
            // Let this exit before we start the function.
            setTimeout(() => {
              MessageUtils.getMsgHdrDetails(window, action.msgUri);
            }, 0);
          }
        } else {
          newMsgData.push(state.msgData[i]);
        }
      }
      newState.msgData = newMsgData;
      return newState;
    }
    case "MSG_HDR_DETAILS": {
      const newState = { ...state };
      const newMsgData = [];
      for (let i = 0; i < state.msgData.length; i++) {
        if (state.msgData[i].msgUri == action.msgUri) {
          newMsgData.push({
            ...state.msgData[i],
            extraLines: action.extraLines,
          });
        } else {
          newMsgData.push(state.msgData[i]);
        }
      }
      newState.msgData = newMsgData;
      return newState;
    }
    case "MSG_SHOW_REMOTE_CONTENT": {
      Conversations.currentConversation.showRemoteContent(action.msgUri);
      return state;
    }
    case "MSG_ALWAYS_SHOW_REMOTE_CONTENT": {
      Conversations.currentConversation.alwaysShowRemoteContent(
        action.realFrom,
        action.msgUri
      );
      return state;
    }
    case "REMOVE_MESSAGE_FROM_CONVERSATION": {
      const newState = { ...state };
      const newMsgData = [];
      for (let i = 0; i < state.msgData.length; i++) {
        if (state.msgData[i].msgUri != action.msgUri) {
          newMsgData.push(state.msgData[i]);
        }
      }
      newState.msgData = newMsgData;
      return newState;
    }
    case "APPEND_MESSAGES": {
      const newState = { ...state };
      newState.msgData = newState.msgData.concat(action.msgData);
      return newState;
    }
    case "DETACH_TAB": {
      // TODO: Fix re-enabling composition when expanded into new tab.
      // let willExpand = element.hasClass("expand") && startedEditing();
      // Pick _initialSet and not msgHdrs so as to enforce the invariant
      //  that the messages from _initialSet are in the current view.
      const urls = state.msgData.map(x => x.msgUri);
      // "&willExpand=" + Number(willExpand);
      // First, save the draft, and once it's saved, then move on to opening the
      // conversation in a new tab...
      // onSave(() => {
      openConversationInTabOrWindow(urls);
      // });
      return state;
    }
    case "MSG_SHOW_NOTIFICATION": {
      return modifyOnlyMsg(state, action.msgData.msgUri, msg => {
        const newMsg = { ...msg };
        if ("extraNotifications" in msg) {
          let i = msg.extraNotifications.findIndex(
            n => n.type == action.msgData.notification.type
          );
          if (i != -1) {
            newMsg.extraNotifications = [...msg.extraNotifications];
            newMsg.extraNotifications[i] = action.msgData.notification;
          } else {
            newMsg.extraNotifications = [
              ...msg.extraNotifications,
              action.msgData.notification,
            ];
          }
        } else {
          newMsg.extraNotifications = [action.msgData.notification];
        }
        return newMsg;
      });
    }
    case "NOTIFICATION_CLICK": {
      const msg = Conversations.currentConversation.getMessage(action.msgUri);
      msg.msgPluginNotification(
        topMail3Pane(window),
        action.notificationType,
        action.extraData
      );
      return state;
    }
    case "TAG_CLICK": {
      const msg = Conversations.currentConversation.getMessage(action.msgUri);
      msg.msgPluginTagClick(topMail3Pane(window), action.event, action.details);
      return state;
    }
    default: {
      return state;
    }
  }
}

function summary(state = initialSummary, action) {
  switch (action.type) {
    case "REPLACE_CONVERSATION_DETAILS": {
      if (!("summary" in action)) {
        return state;
      }
      return {
        ...state,
        ...action.summary,
      };
    }
    case "ADD_CONTACT": {
      browser.convContacts.beginNew({
        email: action.email,
        displayName: action.name,
      });
      // TODO: In theory we should be updating the store so that the button can
      // then be updated to indicate this is now in the address book. However,
      // until we start getting the full conversation messages hooked up, this
      // won't be easy. As this is only a small bit of hidden UI, we can punt on
      // this for now.
      return state;
    }
    case "COPY_EMAIL": {
      navigator.clipboard.writeText(action.email);
      return state;
    }
    case "CREATE_FILTER": {
      topMail3Pane(window).MsgFilters(action.email, null);
      return state;
    }
    case "EDIT_CONTACT": {
      browser.convContacts.beginEdit({
        email: action.email,
      });
      return state;
    }
    case "FORWARD_CONVERSATION": {
      Conversations.currentConversation.forward().catch(console.error);
      return state;
    }
    case "OPEN_LINK": {
      getMail3Pane().messenger.launchExternalURL(action.url);
      return state;
    }
    case "PRINT_CONVERSATION": {
      // TODO: Fix printing
      printConversation();
      return state;
    }
    case "SEND_EMAIL": {
      ContactHelpers.composeMessage(
        action.name,
        action.email,
        topMail3Pane(window).gFolderDisplay.displayedFolder
      );
      return state;
    }
    case "SEND_UNSENT": {
      ConversationUtils.sendUnsent(topMail3Pane(window));
      return state;
    }
    case "SHOW_MESSAGES_INVOLVING": {
      ContactHelpers.showMessagesInvolving(
        topMail3Pane(window),
        action.name,
        action.email
      );
      return state;
    }
    case "SWITCH_TO_FOLDER": {
      ConversationUtils.switchToFolderAndMsg(
        topMail3Pane(window),
        action.msgUri
      );
      return state;
    }
    case "MSG_STREAM_MSG": {
      let newState = { ...state };
      if (!action.dueToExpansion) {
        newState.iframesLoading++;
      }
      state.conversation
        .getMessage(action.msgUri)
        .streamMessage(topMail3Pane(window).msgWindow, action.docshell);
      return newState;
    }
    case "MSG_STREAM_LOAD_FINISHED": {
      let newState = { ...state };
      if (!action.dueToExpansion) {
        newState.iframesLoading--;
        if (newState.iframesLoading < 0) {
          newState.iframesLoading = 0;
        }
      }
      // It might be that we're trying to send a message on unmount, but the
      // conversation/message has gone away. If that's the case, we just skip
      // and move on.
      if (state.conversation && state.conversation.getMessage) {
        const msg = state.conversation.getMessage(action.msgUri);
        if (msg) {
          msg.postStreamMessage(topMail3Pane(window).msgWindow, action.iframe);
        }
      }
      return newState;
    }
    default: {
      return state;
    }
  }
}

const conversationApp = Redux.combineReducers({
  attachments,
  messages,
  summary,
});
