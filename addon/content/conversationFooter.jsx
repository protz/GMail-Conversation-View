/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/* globals PropTypes, React, ReactRedux */
/* exported ConversationFooter */

class _ConversationFooter extends React.PureComponent {
  constructor(props) {
    super(props);
    this.forwardConversation = this.forwardConversation.bind(this);
    this.printConversation = this.printConversation.bind(this);
  }

  forwardConversation() {
    this.props.dispatch({
      type: "FORWARD_CONVERSATION",
    });
  }

  printConversation() {
    this.props.dispatch({
      type: "PRINT_CONVERSATION",
    });
  }

  render() {
    return (
      <div className="bottom-links">
        <a className="link" onClick={this.forwardConversation}>
          {this.props.strings.get("stub.forward.tooltip")}
        </a>{" "}
      </div>
    );
    // TODO: Get printing working again.
    // –{" "}
    // <a className="link" onClick={this.printConversation}>
    //   {this.props.strings.get("stub.print.tooltip")}
    // </a>
  }
}

_ConversationFooter.propTypes = {
  dispatch: PropTypes.func.isRequired,
  strings: PropTypes.object.isRequired,
};

const ConversationFooter = ReactRedux.connect()(_ConversationFooter);
