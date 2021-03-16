// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import React from 'react';
import { Link } from "react-router-dom";
import { Button, Modal, ModalHeader, ModalBody, ModalFooter, Row, Col, Spinner } from 'reactstrap';
import { API, Storage } from 'aws-amplify';

import Results from '../Results/Results.js';
import Running from '../Running/Running.js';
import History from '../History/History.js';

import AceEditor from 'react-ace';
import 'brace';
import 'brace/theme/github';

class Details extends React.Component {

    constructor(props) {
        super(props);
        this.state = {
            isLoading: true,
            runningTasks: false,
            deleteModal: false,
            cancelModal: false,
            testId: props.location.state,
            testDuration: 0,
            data: {
                testName: null,
                testDescription: null,
                testType: null,
                fileType: null,
                results: {},
                history: [],
                taskCount: null,
                concurrency: null,
                rampUp: null,
                holdFor: null,
                endpoint: null,
                method: null,
                taskArns: [],
                testScenario: {
                    execution: [],
                    reporting: [],
                    scenarios: {}
                }
            }
        }
        this.deleteToggle = this.deleteToggle.bind(this);
        this.deleteTest = this.deleteTest.bind(this);
        this.cancelToggle = this.cancelToggle.bind(this);
        this.cancelTest = this.cancelTest.bind(this);
        this.handleStart = this.handleStart.bind(this);
        this.handleDownload = this.handleDownload.bind(this);
        this.caculateTestDurationSeconds = this.caculateTestDurationSeconds.bind(this);
    }

    deleteToggle() {
        this.setState(prevState => ({
            deleteModal: !prevState.deleteModal
        }));
    }

    cancelToggle() {
        this.setState(prevState => ({
            cancelModal: !prevState.cancelModal
        }));
    }

    deleteTest = async () => {
        const { testId } = this.state.testId;
        try {
            await API.del('dlts', `/scenarios/${testId}`);
        } catch (err) {
            alert(err);
        }
        this.props.history.push("dashboard");
    }

    cancelTest = async () => {
        const { testId } = this.state.testId;
        try {
            await API.post('dlts', `/scenarios/${testId}`);
        } catch (err) {
            alert(err);
        }
        this.props.history.push("dashboard");
    }

    reloadData = async () => {
        this.setState({
            isLoading: true,
            data:{
                results:{},
                history:[],
                concurrency:null,
                rampUp:null,
                holdFor: null,
                endpoint:null,
                method:null,
                body:{},
                header:{},
                taskArns:[]
            }
        })
        await this.getTest();
        this.setState({ isLoading: false });
    }

    getTest = async () => {
        const { testId } = this.state.testId;
        try {
            const data = await API.get('dlts', `/scenarios/${testId}`);
            const { testName } = data;
            data.concurrency = data.testScenario.execution[0].concurrency;
            data.rampUp = data.testScenario.execution[0]['ramp-up'];
            data.holdFor = data.testScenario.execution[0]['hold-for'];
            const testDuration = this.caculateTestDurationSeconds([data.rampUp, data.holdFor]);

            // For migration purpose, old version would have undefined value, then it's a simple test.
            if (!data.testType || ['', 'simple'].includes(data.testType)) {
                data.testType = 'simple';
                data.endpoint = data.testScenario.scenarios[`${testName}`].requests[0].url;
                data.method = data.testScenario.scenarios[`${testName}`].requests[0].method;
                data.body = data.testScenario.scenarios[`${testName}`].requests[0].body;
                data.headers = data.testScenario.scenarios[`${testName}`].requests[0].headers;
            }

            this.setState({ data, testDuration });
        } catch (err) {
            console.error(err);
            alert(err);
        }
    }

    listTasks = async () => {
        try {
            const data = await API.get('dlts', '/tasks');
            this.setState({
                isLoading: false,
                runningTasks: data.length > 0
            });
        } catch (err) {
            alert(err);
        }
    };

    caculateTestDurationSeconds = (items) => {
        let seconds = 0;

        for (let item of items) {
            // On the UI, the item format would be always Xm or Xs (X is a number).
            if (item.endsWith('m')) {
                seconds += parseInt(item.slice(0, item.length - 1)) * 60;
            } else {
                seconds += parseInt(item.slice(0, item.length - 1));
            }
        }

        return seconds;
    }

    componentDidMount = async () => {
        if (!this.state.testId) {
            this.props.history.push('/');
        }
        await this.getTest();
        await this.listTasks();
    }

    async handleStart() {
        const { testId } = this.state.testId;
        const { data } = this.state;
        let payload = {
            testId,
            testName: data.testName,
            testDescription: data.testDescription,
            taskCount: data.taskCount,
            testScenario: {
                execution: [{
                    concurrency: data.concurrency,
                    "ramp-up": data.rampUp,
                    "hold-for": data.holdFor,
                    scenario: data.testName,
                }],
                scenarios: {
                    [data.testName]: {}
                }
            },
            testType: data.testType
        };

        if (data.testType === 'simple') {
            payload.testScenario.scenarios[data.testName] = {
                requests: [
                    {
                        url: data.endpoint,
                        method: data.method,
                        body: data.body,
                        headers: data.headers
                    }
                ]
            };
        } else {
            payload.testScenario.scenarios[data.testName] = {
                script: `${testId}.jmx`
            };
            payload.fileType = data.fileType;
        }

        this.setState({ isLoading: true });

        try {
            const response = await API.post('dlts', '/scenarios', { body: payload });
            console.log('Scenario started successfully', response.testId);
            await this.reloadData();
        } catch (err) {
            console.error('Failed to start scenario', err);
            this.setState({ isLoading: false });
        }
    }

    async handleDownload() {
        try {
            const { testId } = this.state.testId;
            const { testType } = this.state.data;

            let filename = this.state.data.fileType === 'zip' ? `${testId}.zip` : `${testId}.jmx`
            const url = await Storage.get(`test-scenarios/${testType}/${filename}`, { expires: 10 });
            window.open(url, '_blank');
        } catch (error) {
            console.error('Error', error);
        }
    }

    render() {
        const { data, testDuration } = this.state;

        const cancelled = (
            <div className="box">
                <h2>测试结果</h2>
                <p>No results available as the test was cancelled.</p>
            </div>
        )

        const failed = (
            <div className="box">
                <h2>测试失败</h2>
                <h6>
                    <pre>{JSON.stringify(data.taskError, null, 2) || data.errorReason}</pre>
                </h6>
            </div>
        )

        const details = (
            <div>
                <div className="box">
                    <h1>压测结果详情</h1>
                    {
                        data.status === 'running' ?
                        [
                            <Button id="cancelButton" key="cancelButton" color="danger" onClick={this.cancelToggle} size="sm">取消测试</Button>,
                            <Button id="refreshButton" key="refreshButton" onClick={ this.reloadData } size="sm">刷新</Button>
                        ] :
                        [
                            <Button id="deleteButton" key="deleteButton" color="danger" onClick={this.deleteToggle} size="sm">删除测试</Button>,
                            <Link key="update_link" to= {{ pathname: '/create', state: { data } }}>
                                <Button id="updateButton" key="updateButton" size="sm">更新测试</Button>
                            </Link>,
                            <Button id="startButton" key="startButton" onClick={this.handleStart} size="sm" disabled={this.state.runningTasks}>开始测试</Button>
                        ]
                    }
                </div>
                <div className="box">
                    <Row>
                        <Col sm="7">
                            <Row className="detail">
                                <Col sm="3"><b>标识</b></Col>
                                <Col sm="9">{data.testId}</Col>
                            </Row>
                            <Row className="detail">
                                <Col sm="3"><b>名称</b></Col>
                                <Col sm="9">{data.testName}</Col>
                            </Row>
                            <Row className="detail">
                                <Col sm="3"><b>描述</b></Col>
                                <Col sm="9">{data.testDescription}</Col>
                            </Row>
                            {
                                (!data.testType || ['', 'simple'].includes(data.testType)) &&
                                <div>
                                    <Row className="detail">
                                        <Col sm="3"><b>访问端点</b></Col>
                                        <Col sm="9">{ data.endpoint }</Col>
                                    </Row>
                                    <Row className="detail">
                                        <Col sm="3"><b>方法</b></Col>
                                        <Col sm="9">{ data.method }</Col>
                                    </Row>
                                    <Row className="detail">
                                        <Col sm="3"><b>HTTP请求</b></Col>
                                        <Col sm="9">
                                            <AceEditor
                                                id="headers"
                                                name="headers"
                                                value={ JSON.stringify(data.headers, null, 2) }
                                                mode="json"
                                                theme="github"
                                                width="100%"
                                                maxLines={10}
                                                showPrintMargin={false}
                                                showGutter={false}
                                                readOnly={true}
                                                editorProps={{$blockScrolling: true}}
                                            />
                                        </Col>
                                    </Row>
                                    <Row className="detail">
                                        <Col sm="3"><b>HTTP主体</b></Col>
                                        <Col sm="9">
                                            <AceEditor
                                                id="body"
                                                name="body"
                                                value={ JSON.stringify(data.body, null, 2) }
                                                mode="json"
                                                theme="github"
                                                width="100%"
                                                maxLines={10}
                                                showPrintMargin={false}
                                                showGutter={false}
                                                readOnly={true}
                                                editorProps={{$blockScrolling: true}}
                                            />
                                        </Col>
                                    </Row>
                                </div>
                            }
                            {
                                data.testType && data.testType !== '' && data.testType !== 'simple' &&
                                <Row className="detail">
                                    <Col sm="3"><b>{ data.fileType === 'zip' ? 'ZIP包' : 'JMX脚本' }</b></Col>
                                    {/* <Col sm="9"><Button className="btn-link-custom" color="link" size="sm" onClick={this.handleDownload}>下载脚本</Button></Col> */}
                                    <Col sm="9"><b>{ '请跳转到https://console.amazonaws.cn/s3，按照以下路径查看：scenariobucket/public/test-scenarios/jmeter/TESTID.jmx' }</b></Col>
                                </Row>
                            }
                        </Col>
                        <Col sm="5">
                            <Row className="detail">
                                <Col sm="4"><b>状态</b></Col>
                                <Col className={data.status} sm="8">{data.status}</Col>
                            </Row>
                            <Row className="detail">
                                <Col sm="4"><b>开始时间</b></Col>
                                <Col sm="8">{data.startTime}</Col>
                            </Row>
                            {
                                data.status === 'complete' &&
                                <Row className="detail">
                                    <Col sm="4"><b>结束时间</b></Col>
                                    <Col sm="8">{data.endTime}</Col>
                                </Row>
                            }
                            <Row className="detail">
                                <Col sm="4"><b>任务数量</b></Col>
                                <Col sm="8">{data.taskCount} {data.status === 'complete' && data.completeTasks !== undefined && `(${data.completeTasks} completed)`}</Col>
                            </Row>

                            <Row className="detail">
                                <Col sm="4"><b>并发量</b></Col>
                                <Col sm="8">{ data.concurrency }</Col>
                            </Row>
                            <Row className="detail">
                                <Col sm="4"><b>预热时间</b></Col>
                                <Col sm="8">{ data.rampUp }</Col>
                            </Row>
                            <Row className="detail">
                                <Col sm="4"><b>持续时间</b></Col>
                                <Col sm="8">{ data.holdFor }</Col>
                            </Row>
                        </Col>
                    </Row>
                </div>

                { data.status === 'complete' && <Results data={data} testDuration={testDuration} /> }
                { data.status === 'cancelled' && cancelled }
                { data.status === 'failed' && failed }
                { data.status === 'running' && <Running data={data} /> }
                { data.status !== 'running' && <History data={data} /> }

            </div>
        )

        return (
            <div>
                { this.state.isLoading ? <div className="loading"><Spinner color="secondary" /></div> : details }
                <Modal isOpen={this.state.deleteModal} toggle={this.deleteToggle}>
                    <ModalHeader>Warning</ModalHeader>
                    <ModalBody>
                        This will delete the test scenario and all of of the results
                    </ModalBody>
                    <ModalFooter>
                        <Button id="cancelDeleteButton" color="link" size="sm" onClick={this.deleteToggle}>取消</Button>
                        <Button id="deleteConfirmButton" color="danger" size="sm" onClick={this.deleteTest}>删除</Button>
                    </ModalFooter>
                </Modal>

                <Modal isOpen={this.state.cancelModal} toggle={this.cancelToggle}>
                    <ModalHeader>Warning</ModalHeader>
                    <ModalBody>
                        This will stop all running tasks and end the test.
                    </ModalBody>
                    <ModalFooter>
                        <Button id="cancelStopButton" color="link" size="sm" onClick={this.cancelToggle}>取消</Button>
                        <Button id="cancelTestButton" color="danger" size="sm" onClick={this.cancelTest}>取消测试</Button>
                    </ModalFooter>
                </Modal>

            </div>
        )
    }
}

export default Details;
