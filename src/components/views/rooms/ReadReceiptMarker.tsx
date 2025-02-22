/*
Copyright 2016 OpenMarket Ltd
Copyright 2019 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React, { createRef, RefObject } from 'react';
import { RoomMember } from "matrix-js-sdk/src/models/room-member";

import { _t } from '../../../languageHandler';
import { formatDate } from '../../../DateUtils';
import NodeAnimator from "../../../NodeAnimator";
import { toPx } from "../../../utils/units";
import { replaceableComponent } from "../../../utils/replaceableComponent";

import MemberAvatar from '../avatars/MemberAvatar';

import { logger } from "matrix-js-sdk/src/logger";

interface IProps {
    // the RoomMember to show the RR for
    member?: RoomMember;
    // userId to fallback the avatar to
    // if the member hasn't been loaded yet
    fallbackUserId: string;

    // number of pixels to offset the avatar from the right of its parent;
    // typically a negative value.
    leftOffset?: number;

    // true to hide the avatar (it will still be animated)
    hidden?: boolean;

    // don't animate this RR into position
    suppressAnimation?: boolean;

    // an opaque object for storing information about this user's RR in
    // this room
    // TODO: proper typing for RR info
    readReceiptInfo: any;

    // A function which is used to check if the parent panel is being
    // unmounted, to avoid unnecessary work. Should return true if we
    // are being unmounted.
    checkUnmounting?: () => boolean;

    // callback for clicks on this RR
    onClick?: (e: React.MouseEvent) => void;

    // Timestamp when the receipt was read
    timestamp?: number;

    // True to show twelve hour format, false otherwise
    showTwelveHour?: boolean;
}

interface IState {
    suppressDisplay: boolean;
    startStyles?: IReadReceiptMarkerStyle[];
}

interface IReadReceiptMarkerStyle {
    top: number;
    left: number;
}

@replaceableComponent("views.rooms.ReadReceiptMarker")
export default class ReadReceiptMarker extends React.PureComponent<IProps, IState> {
    private avatar: React.RefObject<HTMLDivElement | HTMLImageElement | HTMLSpanElement> = createRef();

    static defaultProps = {
        leftOffset: 0,
    };

    constructor(props: IProps) {
        super(props);

        this.state = {
            // if we are going to animate the RR, we don't show it on first render,
            // and instead just add a placeholder to the DOM; once we've been
            // mounted, we start an animation which moves the RR from its old
            // position.
            suppressDisplay: !this.props.suppressAnimation,
        };
    }

    public componentWillUnmount(): void {
        // before we remove the rr, store its location in the map, so that if
        // it reappears, it can be animated from the right place.
        const rrInfo = this.props.readReceiptInfo;
        if (!rrInfo) {
            return;
        }

        // checking the DOM properties can force a re-layout, which can be
        // quite expensive; so if the parent messagepanel is being unmounted,
        // then don't bother with this.
        if (this.props.checkUnmounting && this.props.checkUnmounting()) {
            return;
        }

        const avatarNode = this.avatar.current;
        rrInfo.top = avatarNode.offsetTop;
        rrInfo.left = avatarNode.offsetLeft;
        rrInfo.parent = avatarNode.offsetParent;
    }

    public componentDidMount(): void {
        if (!this.state.suppressDisplay) {
            // we've already done our display - nothing more to do.
            return;
        }
        this.animateMarker();
    }

    public componentDidUpdate(prevProps: IProps): void {
        const differentLeftOffset = prevProps.leftOffset !== this.props.leftOffset;
        const visibilityChanged = prevProps.hidden !== this.props.hidden;
        if (differentLeftOffset || visibilityChanged) {
            this.animateMarker();
        }
    }

    private animateMarker(): void {
        // treat new RRs as though they were off the top of the screen
        let oldTop = -15;

        const oldInfo = this.props.readReceiptInfo;
        if (oldInfo && oldInfo.parent) {
            oldTop = oldInfo.top + oldInfo.parent.getBoundingClientRect().top;
        }

        const newElement = this.avatar.current;
        let startTopOffset;
        if (!newElement.offsetParent) {
            // this seems to happen sometimes for reasons I don't understand
            // the docs for `offsetParent` say it may be null if `display` is
            // `none`, but I can't see why that would happen.
            logger.warn(
                `ReadReceiptMarker for ${this.props.fallbackUserId} in has no offsetParent`,
            );
            startTopOffset = 0;
        } else {
            startTopOffset = oldTop - newElement.offsetParent.getBoundingClientRect().top;
        }

        const startStyles = [];

        if (oldInfo && oldInfo.left) {
            // start at the old height and in the old h pos
            startStyles.push({ top: startTopOffset+"px",
                left: toPx(oldInfo.left) });
        }

        startStyles.push({ top: startTopOffset+'px', left: '0' });

        this.setState({
            suppressDisplay: false,
            startStyles: startStyles,
        });
    }

    public render(): JSX.Element {
        if (this.state.suppressDisplay) {
            return <div ref={this.avatar as RefObject<HTMLDivElement>} />;
        }

        const style = {
            left: toPx(this.props.leftOffset),
            top: '0px',
        };

        let title;
        if (this.props.timestamp) {
            const dateString = formatDate(new Date(this.props.timestamp), this.props.showTwelveHour);
            if (!this.props.member || this.props.fallbackUserId === this.props.member.rawDisplayName) {
                title = _t(
                    "Seen by %(userName)s at %(dateTime)s",
                    { userName: this.props.fallbackUserId,
                        dateTime: dateString },
                );
            } else {
                title = _t(
                    "Seen by %(displayName)s (%(userName)s) at %(dateTime)s",
                    { displayName: this.props.member.rawDisplayName,
                        userName: this.props.fallbackUserId,
                        dateTime: dateString },
                );
            }
        }

        return (
            <NodeAnimator startStyles={this.state.startStyles}>
                <MemberAvatar
                    member={this.props.member}
                    fallbackUserId={this.props.fallbackUserId}
                    aria-hidden="true"
                    aria-live="off"
                    width={14}
                    height={14}
                    resizeMethod="crop"
                    style={style}
                    title={title}
                    onClick={this.props.onClick}
                    inputRef={this.avatar as RefObject<HTMLImageElement>}
                />
            </NodeAnimator>
        );
    }
}
