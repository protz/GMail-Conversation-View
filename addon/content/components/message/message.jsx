/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import React from "react";
import PropTypes from "prop-types";
import { Attachments } from "./attachments.jsx";
import { messageActions } from "../../reducer/reducerMessages.js";
import { MessageDetails } from "./messageDetails.jsx";
import { MessageFooter } from "./messageFooter.jsx";
import { MessageHeader } from "./messageHeader.jsx";
import { MessageIFrame } from "./messageIFrame.jsx";
import { MessageNotification } from "./messageNotification.jsx";
import { MessageTags, SpecialMessageTags } from "./messageTags.jsx";
import { QuickReply } from "../quickreply/quickReply.jsx";

function isAccel(event) {
  if (window.navigator.platform.includes("Mac")) {
    return event.metaKey;
  }
  return event.ctrlKey;
}

/**
 * Trap any errors in child component displaying an error
 * message if any errors are encountered.
 *
 * Code taken from https://reactjs.org/blog/2017/07/26/error-handling-in-react-16.html
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, errorInfo: null };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error,
      errorInfo,
    });
  }

  render() {
    if (this.state.errorInfo) {
      // Error path
      return (
        <div>
          <h4>Error encountered while rendering.</h4>
          <details style={{ whiteSpace: "pre-wrap" }}>
            {this.state.error && this.state.error.toString()}
            <br />
            {this.state.errorInfo.componentStack}
          </details>
        </div>
      );
    }
    // Normally, just render children
    return this.props.children;
  }
}
ErrorBoundary.propTypes = { children: PropTypes.any };

/**
 * Handles display of an individual message.
 */
export class Message extends React.PureComponent {
  constructor(props) {
    super(props);
    this.onSelected = this.onSelected.bind(this);
    this.onKeyDown = this.onKeyDown.bind(this);
  }

  componentDidMount() {
    if (
      this.lastScrolledId != this.props.message.id &&
      this.props.message.scrollTo
    ) {
      this.lastScrolledId = this.props.message.id;
      // The header is 44px high (yes, this is hard coded and ugly).
      window.requestAnimationFrame(() => {
        window.scrollTo(
          0,
          this.li.getBoundingClientRect().top + window.scrollY + 5 - 44
        );
        this.onSelected();
      });
      // For any time we're mounting a new message, we're going to be loading
      // it as well. That means we don't need to clear the scrollTo flag here,
      // we can leave that to componentDidUpdate.
    }
    this.checkLateAttachments();
  }

  componentDidUpdate(prevProps) {
    if (this.props.message.expanded && !this.props.iframesLoading) {
      this.handleAutoMarkAsRead();
    } else if (!this.props.message.expanded || this.props.message.read) {
      this.removeScrollListener();
    }
    if (!this.props.message.scrollTo) {
      return;
    }
    if (
      this.lastScrolledId != this.props.message.id ||
      (prevProps.iframesLoading && !this.props.iframesLoading)
    ) {
      this.lastScrolledId = this.props.message.id;
      // The additional setTimeout gives slightly longer for the event queue
      // to flush, and the message body to finish displaying - this helps the
      // conversation-in-tab view to scroll properly.
      setTimeout(() => {
        window.requestAnimationFrame(() => {
          window.scrollTo(
            0,
            // The header is 44px high (yes, this is hardcoded and ugly).
            this.li.getBoundingClientRect().top + window.scrollY + 5 - 44
          );
          this.onSelected();
          // Only clear scrollTo if we're now not loading any iframes for
          // this message. This should generally mean we get to scroll to the
          // right place most of the time.
          if (!this.props.iframesLoading) {
            this.props.dispatch(
              messageActions.clearScrollto({
                id: this.props.message.id,
              })
            );
          }
        });
      }, 0);
    }
    this.checkLateAttachments();
  }

  componentWillUnmount() {
    this.removeScrollListener();
  }

  checkLateAttachments() {
    if (
      this.props.message.expanded &&
      this.props.message.needsLateAttachments
    ) {
      this.props.dispatch(
        messageActions.getLateAttachments({
          id: this.props.message.id,
        })
      );
    }
  }

  removeScrollListener() {
    if (this._scrollListener) {
      document.removeEventListener("scroll", this._scrollListener, true);
      delete this._scrollListener;
    }
  }

  // Handles setting up the listeners for if we should mark as read when scrolling.
  handleAutoMarkAsRead() {
    // If we're already read, not expanded or auto read is turned off, then we
    // don't need to add listeners.
    if (
      !this.props.autoMarkAsRead ||
      !this.props.message.expanded ||
      this.props.message.read
    ) {
      this.removeScrollListener();
      return;
    }

    if (this._scrollListener) {
      return;
    }

    this._topInView = false;
    this._bottomInView = false;

    this._scrollListener = this.onScroll.bind(this);
    document.addEventListener("scroll", this._scrollListener, true);
  }

  onSelected() {
    this.props.dispatch(
      messageActions.selected({
        id: this.props.message.id,
      })
    );
  }

  onKeyDown(event = {}) {
    if (
      event.target.nodeName == "TEXTAREA" ||
      event.target.nodeName == "INPUT"
    ) {
      return;
    }
    const { key, shiftKey } = event;
    const shortcut = `${isAccel(event) ? "accel-" : ""}${key}`;
    function stopEvent() {
      event.stopPropagation();
      event.preventDefault();
    }

    // Handle the basic keyboard shortcuts
    switch (shortcut) {
      case "accel-r":
      case "accel-R":
        this.props.dispatch(
          messageActions.reply({
            id: this.props.message.id,
            shiftKey,
          })
        );
        stopEvent();
        break;
      case "accel-l":
        this.props.dispatch(
          messageActions.forward({
            id: this.props.message.id,
          })
        );
        break;
      case "accel-u":
        this.props.dispatch(
          messageActions.openSource({
            id: this.props.message.id,
          })
        );
        break;
      case "a":
        this.props.dispatch(
          messageActions.archive({
            id: this.props.message.id,
          })
        );
        break;
      case "o":
        this.props.dispatch(
          messageActions.msgExpand({
            id: this.props.message.id,
            expand: !this.props.message.expanded,
          })
        );
        break;
      case "1":
      case "2":
      case "3":
      case "4":
      case "5":
      case "6":
      case "7":
      case "8":
      case "9":
        this.props.dispatch(
          messageActions.toggleTagByIndex({
            id: this.props.message.id,
            tags: this.props.message.tags,
            // Tag indexes start at 0
            index: +shortcut - 1,
          })
        );
        stopEvent();
        break;
      case "0":
        // Remove all tags
        this.props.dispatch(
          messageActions.setTags({
            id: this.props.message.id,
            tags: [],
          })
        );
        stopEvent();
        break;
      case "f":
        this.props.advanceMessage(1);
        stopEvent();
        break;
      case "b":
        this.props.advanceMessage(-1);
        stopEvent();
        break;
      default:
        break;
    }

    this.onSelected();
  }

  onScroll() {
    const rect = this.li.getBoundingClientRect();

    if (!this._topInView) {
      const top = rect.y;
      if (top > 0 && top < window.innerHeight) {
        this._topInView = true;
      }
    }
    if (!this._bottomInView) {
      const bottom = rect.y + rect.height;
      if (bottom > 0 && bottom < window.innerHeight) {
        this._bottomInView = true;
      }
    }
    if (this._topInView && this._bottomInView) {
      if (!this.props.message.read) {
        this.props.dispatch(
          messageActions.markAsRead({
            id: this.props.message.id,
          })
        );
      }
      this.removeScrollListener();
    }
  }

  render() {
    return (
      <li
        className="message"
        ref={(li) => {
          this.li = li;
          this.props.setRef(li);
        }}
        tabIndex={this.props.index + 1}
        onFocusCapture={this.onSelected}
        onClickCapture={this.onSelected}
        onKeyDownCapture={this.onKeyDown}
      >
        <MessageHeader
          dispatch={this.props.dispatch}
          bcc={this.props.message.bcc}
          cc={this.props.message.cc}
          date={this.props.message.date}
          detailsShowing={this.props.message.detailsShowing}
          expanded={this.props.message.expanded}
          from={this.props.message.from}
          to={this.props.message.to}
          fullDate={this.props.message.fullDate}
          id={this.props.message.id}
          attachments={this.props.message.attachments}
          multipleRecipients={this.props.message.multipleRecipients}
          recipientsIncludeLists={this.props.message.recipientsIncludeLists}
          inView={this.props.message.inView}
          isDraft={this.props.message.isDraft}
          shortFolderName={this.props.message.shortFolderName}
          snippet={this.props.message.snippet}
          starred={this.props.message.starred}
          tags={this.props.message.tags}
          specialTags={this.props.message.specialTags}
        />
        {this.props.message.expanded && this.props.message.detailsShowing && (
          <MessageDetails
            bcc={this.props.message.bcc}
            cc={this.props.message.cc}
            extraLines={this.props.message.extraLines}
            from={this.props.message.from}
            id={this.props.message.id}
            to={this.props.message.to}
          />
        )}
        {this.props.message.expanded && (
          <MessageNotification
            canUnJunk={
              this.props.message.isJunk && !this.props.displayingMultipleMsgs
            }
            dispatch={this.props.dispatch}
            extraNotifications={this.props.message.extraNotifications}
            hasRemoteContent={this.props.message.hasRemoteContent}
            isPhishing={this.props.message.isPhishing}
            isOutbox={this.props.message.isOutbox}
            id={this.props.message.id}
            realFrom={this.props.message.realFrom}
          />
        )}
        <div className="messageBody">
          {this.props.message.expanded && (
            <SpecialMessageTags
              onFolderClick={() => {
                this.props.dispatch(
                  messageActions.switchToFolderAndMsg({
                    id: this.props.message.id,
                  })
                );
              }}
              onTagClick={(event, tag) => {
                this.props.dispatch(
                  messageActions.tagClick({
                    event,
                    id: this.props.message.id,
                    details: tag.details,
                  })
                );
              }}
              folderName={this.props.message.folderName}
              inView={this.props.message.inView}
              specialTags={this.props.message.specialTags}
            />
          )}
          {this.props.message.expanded && (
            <MessageTags
              onTagsChange={(tags) => {
                this.props.dispatch(
                  messageActions.setTags({
                    id: this.props.message.id,
                    tags,
                  })
                );
              }}
              expanded={true}
              tags={this.props.message.tags}
            />
          )}
          {this.props.message.expanded && this.props.message.printBody && (
            <div className="body-container">{this.props.message.printBody}</div>
          )}
          <ErrorBoundary>
            <MessageIFrame
              browserBackgroundColor={this.props.browserBackgroundColor}
              browserForegroundColor={this.props.browserForegroundColor}
              defaultFontSize={this.props.defaultFontSize}
              dispatch={this.props.dispatch}
              expanded={this.props.message.expanded}
              hasRemoteContent={this.props.message.hasRemoteContent}
              smimeReload={this.props.message.smimeReload}
              id={this.props.message.id}
              isInTab={this.props.isInTab}
              initialPosition={this.props.message.initialPosition}
              isStandalone={this.props.isStandalone}
              tenPxFactor={this.props.tenPxFactor}
              prefs={this.props.prefs}
              realFrom={this.props.message.realFrom}
              tabId={this.props.tabId}
              winId={this.props.winId}
            />
          </ErrorBoundary>
          {this.props.message.expanded &&
            !!this.props.message.attachments.length && (
              <Attachments
                dispatch={this.props.dispatch}
                attachments={this.props.message.attachments}
                attachmentsPlural={this.props.message.attachmentsPlural}
                id={this.props.message.id}
              />
            )}
        </div>
        {this.props.message.expanded && (
          <MessageFooter
            dispatch={this.props.dispatch}
            id={this.props.message.id}
            multipleRecipients={this.props.message.multipleRecipients}
            recipientsIncludeLists={this.props.message.recipientsIncludeLists}
            isDraft={this.props.message.isDraft}
          />
        )}
        {this.props.isLastMessage &&
          this.props.message.expanded &&
          !this.props.hideQuickReply && (
            <QuickReply
              id={this.props.message.id}
              multipleRecipients={this.props.message.multipleRecipients}
              recipientsIncludeLists={this.props.message.recipientsIncludeLists}
            />
          )}
      </li>
    );
  }
}

Message.propTypes = {
  autoMarkAsRead: PropTypes.bool.isRequired,
  browserBackgroundColor: PropTypes.string.isRequired,
  browserForegroundColor: PropTypes.string.isRequired,
  defaultFontSize: PropTypes.number.isRequired,
  dispatch: PropTypes.func.isRequired,
  displayingMultipleMsgs: PropTypes.bool.isRequired,
  iframesLoading: PropTypes.number.isRequired,
  index: PropTypes.number.isRequired,
  isInTab: PropTypes.bool.isRequired,
  isLastMessage: PropTypes.bool.isRequired,
  isStandalone: PropTypes.bool.isRequired,
  hideQuickReply: PropTypes.bool.isRequired,
  message: PropTypes.object.isRequired,
  tenPxFactor: PropTypes.number.isRequired,
  prefs: PropTypes.object.isRequired,
  setRef: PropTypes.func.isRequired,
  advanceMessage: PropTypes.func.isRequired,
  tabId: PropTypes.number,
  winId: PropTypes.number,
};
