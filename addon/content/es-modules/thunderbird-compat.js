/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

// A compatability layer that can be imported whether in the browser or
// in Thunderbird

const DEFAULT_LOCALE = {
  extensionName: {
    message: "Thunderbird Conversations",
    description: "Name of the extension.",
  },

  extensionDescription: {
    message: "Brings a conversation view to a Thunderbird near you!",
    description: "Description of the extension.",
  },

  "options.expand_who": {
    message: "By default, expand:",
    description: "Options - label for which messages should be expanded.",
  },

  "options.expand_auto": {
    message: "Automatic",
    description: "Options - label for automatically expanding messages.",
  },

  "options.expand_auto.tooltip": {
    message:
      "If the thread is collapsed, expand all unread messages or the last message. If it is expanded, only expand the selected message in the message list.",
    description: "Options - tooltip for automatically expanding messages.",
  },

  "options.expand_none": {
    message: "No messages",
    description: "Options - label for not expanding messages.",
  },

  "options.expand_all": {
    message: "All messages",
    description: "Options - label for expanding all messages.",
  },

  "options.quoting_title": {
    message: "Quoted text",
    description: "Options - title for quoted text.",
  },

  "options.quoting_desc": {
    message: "Quotes higher than this number of lines will be collapsed.",
    description: "Options - description for quoted text.",
  },

  "options.hide_sigs_title": {
    message: "Hide Signatures",
    description: "Options - title for hiding signatures.",
  },

  "options.hide_sigs_desc": {
    message: "Whether signatures are collapsed by default.",
    description: "Options - description for hiding signatures.",
  },

  "options.friendly_date_title": {
    message: "No friendly dates",
    description: "Options - title for if to show friendly dates.",
  },

  "options.friendly_date_desc": {
    message:
      'In the top right corner, use "normal" dates, just like the message list, instead of "yesterday" and others.',
    description: "Options - description for if to show friendly dates.",
  },

  "options.tweak_chrome_title": {
    message: "Tweak chrome fonts",
    description: "Options - title for tweaking chrome fonts.",
  },

  "options.tweak_chrome_desc": {
    message:
      "Scale down the font size for the conversation chrome (recommended, requires restart).",
    description: "Options - description for tweaking chrome fonts.",
  },

  "options.tweak_bodies_title": {
    message: "Tweak body fonts",
    description: "Options - title for tweaking message body fonts.",
  },

  "options.tweak_bodies_desc": {
    message:
      "Tweak the fonts in the message bodies to make them consistent with the outer font (recommended, requires restart).",
    description: "Options - description for tweaking message body fonts.",
  },

  "options.operate_on_conversations_title": {
    message: "Archive/delete behavior",
    description: "Options - title for archive/delete behavior.",
  },

  "options.operate_on_conversations_desc": {
    message:
      "Toolbar buttons should archive and delete the entire conversation, not just selected messages.",
    description: "Options - description for archive/delete behavior.",
  },

  "options.extra_attachments_title": {
    message: "I love attachments",
    description: "Options - title for attachment settings.",
  },

  "options.extra_attachments_desc": {
    message:
      "In some corner cases, Thunderbird will fail to recognize some attachments. This option allows you to workaround the Thunderbird bug, and makes sure we try to display as many attachments as we can. Use in combination with the Show All Body Parts addon.",
    description: "Options - description for attachment settings.",
  },

  "options.compose_in_tab_title": {
    message: "Hidden composition window",
    description: "Options - title for hidden compose window enabling.",
  },

  "options.compose_in_tab_desc": {
    message:
      "Ctrl-Shift-N opens the hidden, unsupported composition window in a new tab",
    description: "Options - description for hidden compose window enabling.",
  },

  "options.debugging_title": {
    message: "Debugging",
    description: "Options - title for debugging setting.",
  },

  "options.debugging_desc": {
    message:
      "Enable debug output in the system console and the error console. This will generate a lot of messages.",
    description: "Options - description for debugging setting.",
  },

  "options.monospaced_senders_title": {
    message: "Display in monospaced",
    description: "Options - title for monospaced sender setting.",
  },

  "options.monospaced_senders_desc": {
    message:
      "Messages from those addresses/mailing-lists should be displayed in monospaced fonts (separate using commas).",
    description: "Options - description for monospaced sender setting.",
  },
};
const DEFAULT_PREFS = {
  preferences: {
    migratedLegacy: 1,
    hide_quote_length: 5,
    expand_who: 4,
    monospaced_senders: "bugzilla-daemon@mozilla.org",
    no_friendly_date: false,
    uninstall_infos: "",
    logging_enabled: true,
    tweak_bodies: true,
    tweak_chrome: true,
    operate_on_conversations: false,
    enabled: true,
    extra_attachments: false,
    compose_in_tab: true,
    unwanted_recipients: "{}",
    hide_sigs: false,
  },
};

// Make sure the browser object exists
const browser = window.browser || {};

if (!browser.i18n) {
  // Fake what we need from the i18n library
  browser.i18n = {
    getMessage(messageName, substitutions) {
      return (DEFAULT_LOCALE[messageName] || {}).message || "";
    },
  };
}
if (!browser.storage) {
  // Fake what we need from the browser storage library
  const _stored = DEFAULT_PREFS;
  browser.storage = {
    local: {
      async get(key) {
        if (typeof key === "undefined") {
          return _stored;
        }
        if (typeof key === "string") {
          return { [key]: _stored[key] };
        }
        if (Array.isArray(key)) {
          const ret = {};
          for (const k of key) {
            if (k in _stored) {
              ret[k] = _stored[k];
            }
          }
          return ret;
        }
        // the last case is that we are an object with default values
        const ret = {};
        for (const [k, v] of Object.entries(key)) {
          ret[k] = k in _stored ? _stored[k] : v;
        }
        return ret;
      },
      async set(key) {
        return Object.assign(_stored, key);
      },
    },
  };
}

export { browser };
