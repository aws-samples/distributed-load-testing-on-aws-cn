// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import React from 'react';
import { API, Storage } from 'aws-amplify';
import 'brace';
import AceEditor from 'react-ace';
import {
    Col,
    Row,
    Button,
    FormGroup,
    Label,
    Input,
    FormText,
    Spinner,
    InputGroup,
    CustomInput,
} from 'reactstrap';
import * as shortid from 'shortid';

import 'brace/theme/github';

declare var awsConfig;

// Upload file size limit
const FILE_SIZE_LIMIT = 50 * 1024 * 1024;

// Allowed file extentions
const FILE_EXTENSIONS = ['jmx', 'zip'];

class Create extends React.Component {

    constructor(props){
        super(props);
        if (this.props.location.state && this.props.location.state.data.testId) {
            let fileType = '';
            if (this.props.location.state.data.testType && this.props.location.state.data.testType !== 'simple') {
                if (this.props.location.state.data.fileType) {
                    fileType = this.props.location.state.data.fileType;
                } else {
                    fileType = 'script';
                }
            }

            this.state = {
                isLoading: false,
                runningTasks: false,
                testId: this.props.location.state.data.testId,
                file: null,
                validFile: false,
                chooseNewFile: false,
                formValues: {
                    testName: this.props.location.state.data.testName,
                    testDescription: this.props.location.state.data.testDescription,
                    taskCount: this.props.location.state.data.taskCount,
                    concurrency: this.props.location.state.data.concurrency,
                    holdFor: this.props.location.state.data.holdFor.slice(0, -1),
                    holdForUnits: this.props.location.state.data.holdFor.slice(-1),
                    rampUp: this.props.location.state.data.rampUp.slice(0, -1),
                    rampUpUnits: this.props.location.state.data.rampUp.slice(-1),
                    endpoint: this.props.location.state.data.endpoint,
                    method: this.props.location.state.data.method,
                    body: JSON.stringify(this.props.location.state.data.body, null, 2),
                    headers: JSON.stringify(this.props.location.state.data.headers, null, 2),
                    testType: this.props.location.state.data.testType ? this.props.location.state.data.testType : 'simple',
                    fileType: fileType
                }
            }
        } else {
            this.state = {
                isLoading: false,
                runningTasks: false,
                testId: null,
                file: null,
                validFile: false,
                chooseNewFile: false,
                formValues: {
                    testName:'',
                    testDescription: '',
                    taskCount: 0,
                    concurrency:0,
                    holdFor: 0,
                    holdForUnits:'m',
                    rampUp: 0,
                    rampUpUnits: 'm',
                    endpoint: '',
                    method:'GET',
                    body: '',
                    headers: '',
                    testType: 'simple',
                    fileType: ''
                }
            };
        }

        this.form = React.createRef();
        this.handleSubmit = this.handleSubmit.bind(this);
        this.handleInputChange = this.handleInputChange.bind(this);
        this.setFormValue = this.setFormValue.bind(this);
        this.handleBodyPayloadChange = this.handleBodyPayloadChange.bind(this);
        this.handleHeadersChange = this.handleHeadersChange.bind(this);
        this.handleFileChange = this.handleFileChange.bind(this);
        this.handleCheckBox = this.handleCheckBox.bind(this);
        this.parseJson = this.parseJson.bind(this);
        this.listTasks = this.listTasks.bind(this);
    }

    parseJson(str) {
        try {
            return JSON.parse(str);
        } catch (err) {
             return false;
        }
    }

    handleSubmit = async () => {
        const values = this.state.formValues;

        if (!this.form.current.reportValidity() ) {
            this.setState({ isLoading: false });
            return false;
        }

        const testId = this.state.testId ? this.state.testId : shortid.generate();
        let payload = {
            testId,
            testName: values.testName,
            testDescription: values.testDescription,
            taskCount: parseInt(values.taskCount),
            testScenario: {
                execution: [{
                    concurrency: parseInt(values.concurrency),
                    "ramp-up": String(parseInt(values.rampUp)).concat(values.rampUpUnits),
                    "hold-for": String(parseInt(values.holdFor)).concat(values.holdForUnits),
                    scenario: values.testName
                }],
                scenarios: {
                    [values.testName]: {}
                }
            },
            testType: values.testType,
            fileType: values.fileType
        };

        if (values.testType === 'simple') {
            if (!values.headers) {
                values.headers = '{}';
            }
            if (!values.body) {
                values.body = '{}';
            }
            if (!this.parseJson(values.headers.trim())) {
                return alert('WARNING: headers text is not valid JSON');
            }
            if (!this.parseJson(values.body.trim())) {
                return alert('WARNING: body text is not valid JSON');
            }

            payload.testScenario.scenarios[values.testName] = {
                requests: [
                    {
                        url: values.endpoint,
                        method: values.method,
                        body: this.parseJson(values.body.trim()),
                        headers: this.parseJson(values.headers.trim())
                    }
                ]
            };
        } else {
            payload.testScenario.scenarios[values.testName] = {
                script: `${testId}.jmx`
            };

            if (this.state.file) {
                try {
                    const file = this.state.file;
                    let filename = `${testId}.jmx`;

                    if (file.type && file.type.includes('zip')) {
                        payload.fileType = 'zip';
                        filename = `${testId}.zip`;
                    } else {
                        payload.fileType = 'script';
                    }

                    await Storage.put(`test-scenarios/jmeter/${filename}`, file);
                    console.log('Script uploaded successfully');
                } catch (error) {
                    console.error('Error', error);
                }
            }
        }

        this.setState({ isLoading: true });

        try {
            const response = await API.post('dlts', '/scenarios', { body: payload });
            console.log('Scenario created successfully', response.testId);
            this.props.history.push({ pathname: '/details', state: { testId: response.testId } });
        } catch (err) {
            console.error('Failed to create scenario', err);
            this.setState({ isLoading: false });
        }
    }

    setFormValue(key, value) {
        const formValues = this.state.formValues;
        formValues[key] = value;
        this.setState({ formValues });
    }

    handleInputChange(event) {
        const value = event.target.value;
        const name = event.target.name;

        if (name === 'testType') {
            this.setState({ file: null });
        }

        this.setFormValue(name, value);
    }

    handleBodyPayloadChange(value) {
        this.setFormValue('body', value);
    }

    handleHeadersChange(value) {
        this.setFormValue('headers', value);
    }

    handleFileChange(event) {
        const file = event.target.files[0];
        this.setState({
            file: null,
            validFile: false
        });

        if (file) {
            const { name, size } = file;
            const extension = name.split('.').pop();

            // Limit upload file size
            if (size > FILE_SIZE_LIMIT) {
                return alert(`WARNING: exceeded file size limit ${FILE_SIZE_LIMIT}`);
            }

            // Limit file extension
            if (!FILE_EXTENSIONS.includes(extension)) {
                return alert(`WARNING: only allows (${FILE_EXTENSIONS.join(',')}) files.`);
            }

            this.setState({
                file,
                validFile: true
            });
        }
    }

    handleCheckBox(event) {
        const { checked } = event.target;
        if (checked) {
            this.setState({
                validFile: false,
                file: null
            });
        } else {
            this.setState({ validFile: true });
        }
        this.setState({ chooseNewFile: checked });
    }

    listTasks = async () => {
        try {
            const data = await API.get('dlts', '/tasks');
            if (data.length !== 0 ) {
                this.setState({ runningTasks: true });
            }
        } catch (err) {
            alert(err);
        }
    };

    async componentDidMount() {
        await this.listTasks();
    }

    render() {

        const cancel = () => {
            return this.state.testId === null ?
                this.props.history.push('/') :
                this.props.history.push({ pathname: '/details', state: { testId: this.state.testId }})
        }

        const warning = (
            <div>
                <div className="box">
                    <h1>{ this.state.testId === null ? '创建' : '更新' }压力测试</h1>
                </div>
                <p className="warning">Warning there is a test running, multiple concurrent tests is currently not supported to avoid hitting the AWS Fargate task limits. Please wait for the test to finish before submitting a new test!</p>
            </div>

        )

        const heading = (
            <div className="box">
                <h1>{ this.state.testId === null ? '创建' : '更新' }压力测试</h1>
            </div>
        )

        const createTestForm = (
            <div>
                <Row>
                    <Col sm="6">
                        <div className="box create-box">
                            <h3>基础设置</h3>
                            <FormGroup>
                                <Label for="testName">测试例名称</Label>
                                <Input
                                    value={this.state.formValues.testName}
                                    type="text"
                                    name="testName"
                                    id="testName"
                                    required
                                    onChange={this.handleInputChange}
                                />
                                <FormText color="muted">
                                    测试例名称，可以非全局唯一
                                </FormText>
                            </FormGroup>
                            <FormGroup>
                                <Label for="testDescription">测试例描述</Label>
                                <Input
                                    value={this.state.formValues.testDescription}
                                    type="textarea"
                                    name="testDescription"
                                    id="testDescription"
                                    required
                                    onChange={this.handleInputChange}
                                />
                                <FormText color="muted">
                                    测试场景描述
                                </FormText>
                            </FormGroup>
                            <FormGroup>
                                <Label for="taskCount">任务数量</Label>
                                <Input
                                    value={this.state.formValues.taskCount}
                                    className="form-short"
                                    type="number"
                                    name="taskCount"
                                    id="taskCount"
                                    max={500}
                                    min={1}
                                    step={1}
                                    required
                                    onChange={this.handleInputChange}
                                />
                                <FormText color="muted">
                                    最多可拉起的任务数量，每个任务对应一个容器，目前最大值500
                                </FormText>
                            </FormGroup>

                            <FormGroup>
                                <Label for="concurrency">用户并发量</Label>
                                <Input
                                    value={this.state.formValues.concurrency}
                                    className="form-short"
                                    type="number"
                                    max={200}
                                    min={1}
                                    step={1}
                                    name="concurrency"
                                    id="concurrency"
                                    required
                                    onChange={this.handleInputChange}
                                />
                                <FormText color="muted">
                                    每个任务可以模拟的虚拟用户数量，目前最大值200
                                </FormText>
                            </FormGroup>
                            <FormGroup>
                                <Label for="rampUp">预热时间</Label>
                                <InputGroup className="input-group-short">
                                    <Input
                                        value={this.state.formValues.rampUp}
                                        className="form-short"
                                        type="number"
                                        name="rampUp"
                                        id="rampUp"
                                        required
                                        onChange={this.handleInputChange}
                                    />
                                    &nbsp;
                                    <Input
                                        type="select"
                                        className="form-short"
                                        name="rampUpUnits"
                                        value={this.state.formValues.rampUpUnits}
                                        id="rampUpUnits"
                                        onChange={this.handleInputChange}
                                    >
                                        <option value="m">分钟</option>
                                        <option value="s">秒钟</option>
                                    </Input>
                                </InputGroup>

                                <FormText color="muted">
                                    达到预设并发量的预热时间
                                </FormText>
                            </FormGroup>
                            <FormGroup>
                                <Label for="holdFor">持续时间</Label>
                                <InputGroup className="input-group-short">
                                    <Input
                                        value={this.state.formValues.holdFor}
                                        className="form-short"
                                        type="number"
                                        min={1}
                                        name="holdFor"
                                        id="holdFor"
                                        required
                                        onChange={this.handleInputChange}
                                    />
                                    &nbsp;
                                    <Input
                                        type="select"
                                        value={this.state.formValues.holdForUnits}
                                        className="form-short"
                                        name="holdForUnits"
                                        id="holdForUnits"
                                        onChange={this.handleInputChange}
                                    >
                                        <option value="m">分钟</option>
                                        <option value="s">秒钟</option>
                                    </Input>
                                </InputGroup>
                                <FormText color="muted">
                                    保持预设并发量的持续时间
                                </FormText>
                            </FormGroup>
                        </div>
                    </Col>
                    <Col sm="6">
                        <div className="box create-box">
                            <h3>测试场景</h3>
                            <FormGroup>
                                <Label for="testType">测试类型</Label>
                                <Input
                                    type="select"
                                    id="testType"
                                    name="testType"
                                    required
                                    value={this.state.formValues.testType}
                                    onChange={this.handleInputChange}
                                >
                                    <option value="simple">HTTP端点</option>
                                    <option value="jmeter">JMeter</option>
                                </Input>
                            </FormGroup>
                            {
                                this.state.formValues.testType === 'simple' &&
                                <div>
                                    <FormGroup>
                                        <Label for="endpoint">进行测试的HTTP端点</Label>
                                        <Input
                                            value={this.state.formValues.endpoint}
                                            type="url"
                                            name="endpoint"
                                            id="endpoint"
                                            required
                                            onChange={this.handleInputChange}
                                        />
                                        <FormText color="muted">
                                            执行压力测试的目标URL, 支持HTTP和HTTPS，例如
                                            https://example.com:8080.
                                        </FormText>
                                    </FormGroup>
                                    <FormGroup>
                                        <Label for="method">HTTP方法</Label>
                                        <Input
                                            value={this.state.formValues.method}
                                            className="form-short"
                                            type="select"
                                            name="method"
                                            id="method"
                                            required
                                            onChange={this.handleInputChange}
                                        >
                                            <option>GET</option>
                                            <option>PUT</option>
                                            <option>POST</option>
                                            <option>DELETE</option>
                                        </Input>

                                        <FormText color="muted">
                                            请求方法，默认为GET.
                                        </FormText>
                                    </FormGroup>
                                    <FormGroup>
                                        <Label for="testDescription">HTTP报文头(可选)</Label>
                                        <AceEditor
                                            id="headers"
                                            mode="json"
                                            theme="github"
                                            value={this.state.formValues.headers}
                                            highlightActiveLine={true}
                                            onChange={this.handleHeadersChange}
                                            name="headers"
                                            width="100%"
                                            height="190px"
                                            editorProps={{$blockScrolling: true}}
                                            setOptions={{
                                                showLineNumbers: true,
                                                tabSize: 2,
                                            }}
                                        />
                                        <FormText color="muted">
                                            包含在HTTP请求报文头中的键值内容，JSON格式
                                        </FormText>
                                    </FormGroup>
                                    <FormGroup>
                                        <Label>HTTP请求报文主体内容(可选)</Label>
                                        <AceEditor
                                            id="bodyPayload"
                                            mode="json"
                                            theme="github"
                                            highlightActiveLine={true}
                                            onChange={this.handleBodyPayloadChange}
                                            name="bodyPayload"
                                            value={this.state.formValues.body}
                                            width="100%"
                                            height="190px"
                                            editorProps={{$blockScrolling: true}}
                                            setOptions={{
                                                showLineNumbers: true,
                                                tabSize: 2,
                                            }}
                                        />
                                        <FormText color="muted">
                                            包含在HTTP请求报文主体中的键值内容，JSON格式
                                        </FormText>
                                    </FormGroup>
                                </div>
                            }
                            {
                                this.state.formValues.testType !== 'simple' &&
                                <div>
                                    {
                                        ['zip', 'script'].includes(this.state.formValues.fileType) &&
                                        <FormGroup check>
                                            <Label check>
                                                <Input id="newScriptCheckboux" type="checkbox" onClick={this.handleCheckBox} defaultChecked={this.state.chooseNewFile} /> 选择一个新文件
                                            </Label>
                                        </FormGroup>
                                    }
                                    {
                                        ((this.state.formValues.testType !== 'simple' && !['zip', 'script'].includes(this.state.formValues.fileType)) || this.state.chooseNewFile) &&
                                        <FormGroup>
                                            <Label for="fileUpload">上传文件</Label>
                                            {/* <CustomInput
                                                type="file"
                                                id="fileUpload"
                                                name="fileUpload"
                                                onChange={this.handleFileChange}
                                                disabled={this.state.runningTasks} /> */}
                                            <FormText color="muted">
                                                请跳转到https://console.amazonaws.cn/s3，按照以下路径上传：{awsConfig.aws_user_files_s3_bucket}/public/test-scenarios/jmeter/[TESTID].jmx，其中TESTID为您测试用例的唯一标示（如x7-TL9Gup），您可以选择 <code>.jmx</code> 文件或者 <code>.zip</code> 文件。
                                            </FormText>
                                        </FormGroup>
                                    }
                                </div>
                            }
                            <Button
                                id="submitButton"
                                className="submit"
                                size="sm"
                                onClick={this.handleSubmit}
                                disabled={this.state.runningTasks
                                    // (this.state.formValues.testType !== 'simple' && (!this.state.file && (this.state.chooseNewFile || !['zip', 'script'].includes(this.state.formValues.fileType))))
                                }
                            >
                                提交
                            </Button>
                            <Button
                                id="cancelButton"
                                className="submit"
                                color="danger"
                                size="sm"
                                onClick={cancel}
                                disabled={this.state.isLoading}
                            >
                                取消
                            </Button>
                        </div>
                    </Col>
                </Row>
            </div>
        );

        return (
            <div>
                <form ref={this.form} onSubmit={e => e.preventDefault()}>

                    { this.state.runningTasks ? warning : heading }

                    <div>
                        {this.state.isLoading ? <div className="loading"><Spinner color="secondary" /></div> : createTestForm}
                    </div>
                </form>
            </div>
        )
    }
}

export default Create;
