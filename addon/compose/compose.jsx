/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import React from "react";
import * as ReactRedux from "react-redux";
import * as RTK from "@reduxjs/toolkit";
import { composeApp } from "./reducer.js";
import { ComposeWidget } from "../content/components/compose/ComposeWidget.jsx";

export const store = RTK.configureStore({ reducer: composeApp });

// The entry point for the compose page
export function Main() {
  return (
    <ReactRedux.Provider store={store}>
      <ComposeWidget />
    </ReactRedux.Provider>
  );
}
