/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/* globals PropTypes, React, StringBundle, ActionButton, SvgIcon, messageActions */
/* exported MessageHeaderOptions */

class OptionsMoreMenu extends React.PureComponent {
  constructor(props) {
    super(props);
    this.strings = new StringBundle(
      "chrome://conversations/locale/template.properties"
    );
  }

  render() {
    return (
      <div className="tooltip tooltip-menu menu">
        <div className="arrow"></div>
        <div className="arrow inside"></div>
        <ul>
          <li className="action-reply">
            <ActionButton
              callback={this.props.msgSendAction}
              className="optionsButton"
              showString={true}
              type="reply"
            />
          </li>
          {this.props.multipleRecipients && (
            <li className="action-replyAll">
              <ActionButton
                callback={this.props.msgSendAction}
                className="optionsButton"
                showString={true}
                type="replyAll"
              />
            </li>
          )}
          {this.props.recipientsIncludeLists && (
            <li className="action-replyList">
              <ActionButton
                callback={this.props.msgSendAction}
                className="optionsButton"
                showString={true}
                type="replyList"
              />
            </li>
          )}
          <li className="action-editNew">
            <ActionButton
              callback={this.props.msgSendAction}
              className="optionsButton"
              showString={true}
              type="editAsNew"
            />
          </li>
          <li className="action-forward dropdown-sep">
            <ActionButton
              callback={this.props.msgSendAction}
              className="optionsButton"
              showString={true}
              type="forward"
            />
          </li>
          <li className="action-archive">
            <ActionButton
              callback={this.props.msgSendAction}
              className="optionsButton"
              showString={true}
              type="archive"
            />
          </li>
          <li className="action-delete">
            <ActionButton
              callback={this.props.msgSendAction}
              className="optionsButton"
              showString={true}
              type="delete"
            />
          </li>
          <li className="action-classic">
            <ActionButton
              callback={this.props.msgSendAction}
              className="optionsButton"
              showString={true}
              type="classic"
            />
          </li>
          <li className="action-source">
            <ActionButton
              callback={this.props.msgSendAction}
              className="optionsButton"
              showString={true}
              type="source"
            />
          </li>
        </ul>
      </div>
    );
  }
}

OptionsMoreMenu.propTypes = {
  multipleRecipients: PropTypes.bool.isRequired,
  recipientsIncludeLists: PropTypes.bool.isRequired,
  msgSendAction: PropTypes.func.isRequired,
};

class MessageHeaderOptions extends React.PureComponent {
  constructor(props) {
    super(props);
    this.strings = new StringBundle(
      "chrome://conversations/locale/template.properties"
    );
    this.replyAction = this.replyAction.bind(this);
    this.showDetails = this.showDetails.bind(this);
    this.displayMenu = this.displayMenu.bind(this);
    this.state = {
      expanded: false,
    };
  }

  componentWillUnmount() {
    if (this.clickListener) {
      document.removeEventListener("click", this.clickListener);
      document.removeEventListener("keypress", this.keyListener);
      document.removeEventListener("blur", this.keyListener);
      this.clickListener = null;
      this.keyListener = null;
    }
  }

  replyAction(msg, event) {
    event.stopPropagation();
    event.preventDefault();

    const payload = {
      msgUri: this.props.msgUri,
      shiftKey: msg.shiftKey,
    };
    let action = null;
    switch (msg.type) {
      case "reply":
        action = messageActions.msgReply(payload);
        break;
      case "replyAll":
        action = messageActions.msgReplyAll(payload);
        break;
      case "replyList":
        action = messageActions.msgReplyList(payload);
        break;
      case "forward":
        action = messageActions.msgForward(payload);
        break;
      case "editAsNew":
        action = messageActions.editAsNew(payload);
        break;
      case "archive":
        action = messageActions.msgArchive({ id: this.props.id });
        break;
      case "delete":
        action = messageActions.msgDelete({ id: this.props.id });
        break;
      case "classic":
        action = messageActions.msgOpenClassic(payload);
        break;
      case "source":
        action = messageActions.msgOpenSource(payload);
        break;
      default:
        console.error("Don't know how to create an action for", msg);
    }
    this.props.dispatch(action);
  }

  showDetails(event) {
    event.preventDefault();
    event.stopPropagation();
    // Force a blur, so that the button looks correct after clicking.
    event.target.blur();
    this.props.dispatch({
      type: "MSG_SHOW_DETAILS",
      msgUri: this.props.msgUri,
      show: !this.props.detailsShowing,
    });
  }

  displayMenu(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!this.clickListener) {
      this.clickListener = event => {
        this.clearMenu();
      };
      this.keyListener = event => {
        if (event.keyCode == KeyEvent.DOM_VK_ESCAPE) {
          this.clearMenu();
        }
      };
      this.onBlur = event => {
        this.clearMenu();
      };
      document.addEventListener("click", this.clickListener);
      document.addEventListener("keypress", this.keyListener);
      document.addEventListener("blur", this.onBlur);
    }

    this.setState(prevState => ({ expanded: !prevState.expanded }));
  }

  clearMenu() {
    this.setState({ expanded: false });
    if (this.clickListener) {
      document.removeEventListener("click", this.clickListener);
      document.removeEventListener("keypress", this.keyListener);
      document.removeEventListener("blur", this.keyListener);
      this.clickListener = null;
      this.keyListener = null;
    }
  }

  render() {
    let actionButtonType = "reply";
    if (this.props.recipientsIncludeLists) {
      actionButtonType = "replyList";
    } else if (this.props.multipleRecipients) {
      actionButtonType = "replyAll";
    } else if (this.props.isDraft) {
      actionButtonType = "draft";
    }

    return (
      <div className="options">
        {!!this.props.attachments.length && (
          <span className="attachmentIcon">
            <SvgIcon hash={"attachment"} />
          </span>
        )}
        <span className="date">
          <span title={this.props.fullDate}>{this.props.date}</span>
        </span>
        {this.props.expanded && (
          <span className="mainActionButton">
            <ActionButton
              callback={this.replyAction}
              className="icon-link"
              type={actionButtonType}
            />
          </span>
        )}
        {this.props.expanded && (
          <span
            className={
              "details" + this.props.detailsShowing ? "details-hidden" : ""
            }
          >
            <a
              className="icon-link"
              onClick={this.showDetails}
              title={
                this.props.detailsShowing
                  ? this.strings.get("hideDetails")
                  : this.strings.get("details")
              }
            >
              <SvgIcon
                hash={this.props.detailsShowing ? "info" : "info_outline"}
              />
            </a>
          </span>
        )}
        {this.props.expanded && (
          <span className="dropDown">
            <button
              onClick={this.displayMenu}
              className="icon-link top-right-more"
              title={this.strings.get("more")}
            >
              <SvgIcon hash={"more_vert"} />
            </button>
            {this.state.expanded && (
              <OptionsMoreMenu
                recipientsIncludeLists={this.props.recipientsIncludeLists}
                msgSendAction={this.replyAction}
                multipleRecipients={this.props.multipleRecipients}
              />
            )}
          </span>
        )}
      </div>
    );
  }
}

MessageHeaderOptions.propTypes = {
  dispatch: PropTypes.func.isRequired,
  date: PropTypes.string.isRequired,
  detailsShowing: PropTypes.bool.isRequired,
  expanded: PropTypes.bool.isRequired,
  fullDate: PropTypes.string.isRequired,
  id: PropTypes.number.isRequired,
  msgUri: PropTypes.string.isRequired,
  attachments: PropTypes.array.isRequired,
  multipleRecipients: PropTypes.bool.isRequired,
  recipientsIncludeLists: PropTypes.bool.isRequired,
  isDraft: PropTypes.bool.isRequired,
};
