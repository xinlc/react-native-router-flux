/**
 * Copyright (c) 2015-present, Pavel Aksonov
 * All rights reserved.
 *
 * This source code is licensed under the BSD-style license found in the
 * LICENSE file in the root directory of this source tree.
 *
 */
import React, {
  Component,
  PropTypes,
} from 'react';
import { BackHandler } from 'react-native';
import NavigationExperimental from 'react-native-experimental-navigation';

import Actions, { ActionMap } from './Actions';
import getInitialState from './State';
import Reducer, { findElement } from './Reducer';
import DefaultRenderer from './DefaultRenderer';
import Scene from './Scene';
import * as ActionConst from './ActionConst';

const {
  RootContainer: NavigationRootContainer,
} = NavigationExperimental;

const propTypes = {
  dispatch: PropTypes.func,
  backAndroidHandler: PropTypes.func,
  onBackAndroid: PropTypes.func,
  onExitApp: PropTypes.func,
};

// 全局router，用于android返回
const globalRouters = {};
const routerIDs = [];

class Router extends Component {
  static childContextTypes = {
    routes: PropTypes.object,
  }

  constructor(props) {
    super(props);
    this.Actions = new Actions();

    globalRouters[props.routerID] = this.Actions;

    this.renderNavigation = this.renderNavigation.bind(this);
    this.handleProps = this.handleProps.bind(this);
    this.handleBackAndroid = this.handleBackAndroid.bind(this);
    // Leo: 生成 4位 routerId
    // this._routerId = (((1+Math.random())*0x10000)|0).toString(16).substring(1);

    const reducer = this.handleProps(props);
    this.state = { reducer };
  }

  getChildContext() {
    return {
      routes: this.Actions,
    };
  }

  getRoutes() {
    return this.Actions;
  }

  componentDidMount() {
    BackHandler.addEventListener('hardwareBackPress', this.handleBackAndroid);
  }

  componentWillReceiveProps(props) {
    const reducer = this.handleProps(props);
    this.setState({ reducer });
  }

  componentWillUnmount() {
    BackHandler.removeEventListener('hardwareBackPress', this.handleBackAndroid);
  }

  handleBackAndroid() {
    const {
      backAndroidHandler,
      onBackAndroid,
      onExitApp,
    } = this.props;
    // optional for customizing handler

    if (backAndroidHandler) {
      return backAndroidHandler();
    }

    try {
      const id = routerIDs[routerIDs.length - 1];
      const currentActions = globalRouters[id] || this.Actions;
      currentActions.pop();
      if (onBackAndroid) {
        onBackAndroid();
      }
      return true;
    } catch (err) {
      if (onExitApp) {
        return onExitApp();
      }

      return false;
    }
  }

  handleProps(props) {

    let scenesMap;

    if (props.scenes) {
      scenesMap = props.scenes;
    } else {
      let scenes = props.children;

      if (Array.isArray(props.children) || props.children.props.component) {
        scenes = (
          <Scene
            key="__root"
            hideNav
            {...this.props}
          >
            {props.children}
          </Scene>
        );
      }
      scenesMap = this.Actions.create(scenes, props.wrapBy);
    }

    // eslint-disable-next-line no-unused-vars
    const { children, styles, scenes, reducer, createReducer, ...parentProps } = props;

    scenesMap.rootProps = parentProps;

    const initialState = getInitialState(scenesMap);
    const reducerCreator = props.createReducer || Reducer;

    const routerReducer = props.reducer || (
      reducerCreator({
        initialState,
        scenes: scenesMap,
      }));
    return routerReducer;
  }

  renderNavigation(navigationState, onNavigate) {
    if (!navigationState) {
      return null;
    }
    this.Actions.get = key => findElement(navigationState, key, ActionConst.REFRESH);
    this.Actions.callback = props => {
      const constAction = (props.type && ActionMap[props.type] ? ActionMap[props.type] : null);

      switch (constAction) {
        case ActionConst.PUSH:
          routerIDs.push(navigationState.routerID);
          break;
        case ActionConst.BACK:
        case ActionConst.BACK_ACTION:
          routerIDs.pop();
          break;
        case ActionConst.POP_AND_REPLACE:
        case ActionConst.POP_TO:
        case ActionConst.REFRESH:
        case ActionConst.PUSH_OR_POP:
        case ActionConst.JUMP:
        case ActionConst.REPLACE:
        case ActionConst.RESET:
          break;
        default:
          break;
      }

      if (this.props.dispatch) {
        if (constAction) {
          this.props.dispatch({ ...props, type: constAction });
        } else {
          this.props.dispatch(props);
        }
      }
      return (constAction ? onNavigate({ ...props, type: constAction }) : onNavigate(props));
    };

    return <DefaultRenderer onNavigate={onNavigate} navigationState={navigationState} />;
  }

  render() {
    if (!this.state.reducer) return null;

    return (
      <NavigationRootContainer
        reducer={this.state.reducer}
        renderNavigation={this.renderNavigation}
      />
    );
  }
}

Router.propTypes = propTypes;

export default Router;
