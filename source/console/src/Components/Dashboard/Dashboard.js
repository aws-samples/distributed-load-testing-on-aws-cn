// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import React from 'react';
import { Table, Spinner, Button } from 'reactstrap';
import { Link } from "react-router-dom";
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faArrowAltCircleRight } from '@fortawesome/free-solid-svg-icons';
import { API } from 'aws-amplify';

class Dashboard extends React.Component {

    constructor(props) {
        super(props);
        this.state = {
            Items: [],
            isLoading: true
        }
    }

    getItems = async () => {
        this.setState({
            Items: [],
            isLoading: true
        });

        try {
            const data = await API.get('dlts', '/scenarios');
            data.Items.sort((a, b) => {
                if (!a.startTime) a.startTime = '';
                if (!b.startTime) b.startTime = '';
                return b.startTime.localeCompare(a.startTime)
            });

            this.setState({
                Items: data.Items,
                isLoading: false
            });
        } catch (err) {
            alert(err);
        }
    };

    componentDidMount() {
        this.getItems();
    }

    render() {
        const { Items } = this.state;

        const welcome = (
            <div className="welcome">
                <h2>点击创建测试开始进行您的第一个测试</h2>
            </div>
        )

        const tableBody = (
            <tbody>
            {
                Items.map(item => (
                    <tr key={item.testId}>
                        <td>{item.testName}</td>
                        <td>{item.testId}</td>
                        <td className="desc">{item.testDescription}</td>
                        <td>{item.startTime}</td>
                        <td className={item.status}>{item.status}</td>
                        <td className="td-center">
                            <Link id={`detailLink-${item.testId}`} to= {{ pathname: "/details", state: { testId: item.testId } }}>
                                <FontAwesomeIcon icon={faArrowAltCircleRight} size="lg" />
                            </Link>
                        </td>
                    </tr>
                ))
            }
            </tbody>
        )

        return (
            <div>
                <div className="box">
                    <h1>测试场景</h1>
                    <Button id="refreshButton" onClick={ this.getItems } size="sm">刷新</Button>
                </div>
                <div className="box">
                    <Table className="dashboard" borderless responsive >
                        <thead>
                            <tr>
                                <th>名称</th>
                                <th>标识</th>
                                <th>描述</th>
                                <th>上次运行时间 (UTC)</th>
                                <th>状态</th>
                                <th className="td-center">详情</th>
                            </tr>
                        </thead>
                        { tableBody }
                    </Table>
                    {
                        this.state.isLoading &&
                        <div className="loading">
                            <Spinner color="secondary" />
                        </div>
                    }
                </div>
                { !this.state.isLoading && Items.length === 0 && welcome }
            </div>
        )
    }
}

export default Dashboard;
