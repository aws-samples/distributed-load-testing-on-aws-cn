// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import React from 'react';
import { Row, Col } from 'reactstrap';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExternalLinkAlt } from '@fortawesome/free-solid-svg-icons';
declare var awsConfig;

class Running extends React.Component {

    render() {
        let provisioning = 0;
        let pending = 0;
        let running = 0;

        for (let task in this.props.data.tasks) {
               // eslint-disable-next-line default-case
            switch (this.props.data.tasks[task].lastStatus) {
                case 'PROVISIONING':
                    ++provisioning
                    break;
                case 'PENDING':
                    ++pending
                    break;
                case 'RUNNING':
                    ++running
                    break;
            }
        }

        return (
            <div>
                <div className="box">
                    <h3>任务状态:</h3>
                    <span className="console">
                        执行中任务的详细信息可查看 <a className="text-link"
                        href={awsConfig.ecs_dashboard}
                        target="_blank"
                        rel="noopener noreferrer">
                            Amazon ECS Console <FontAwesomeIcon size="sm" icon={faExternalLinkAlt}/>
                        </a>
                    </span>

                    <Row>
                        <Col sm="3">
                            <div className="result">
                                <b>总任务数量:</b><span>{this.props.data.tasks.length} of {this.props.data.taskCount}</span>
                            </div>
                        </Col>
                        <Col sm="3">
                            <div className="result">
                                <b>配置任务数量:</b><span>{provisioning}</span>
                            </div>
                        </Col>
                        <Col sm="3">
                            <div className="result">
                                <b>等待任务数量:</b><span>{pending}</span>
                            </div>
                        </Col>
                        <Col sm="3">
                            <div className="result">
                                <b>执行任务数量:</b><span>{running}</span>
                            </div>
                        </Col>
                    </Row>
                </div>
                <div className="box">
                <h3>实时平均返回时间</h3>
                    <p className="console">
                        可通过 <a className="text-link"
                        href={ awsConfig.cw_dashboard}
                        target="_blank"
                        rel="noopener noreferrer">
                        Amazon CloudWatch Metrics Dashboard <FontAwesomeIcon size="sm" icon={faExternalLinkAlt}/>
                        </a>进行监控实时平均返回时间
                    </p>
                    <p className="note"> 任务运行后，响应时间将开始增加，10个任务作为1个批次启动，任务较多（400）的情况下所有任务启动需要等待5-6分钟左右</p>
                </div>
            </div>
        )
    }

}

export default Running;
