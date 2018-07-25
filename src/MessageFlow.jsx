import React from 'react';
import Widget from '@wso2-dashboards/widget';
import $ from 'jquery';
import dagreD3 from 'dagre-d3';
import * as d3 from 'd3';
import './custom.css';
import aggregatorDataProviderConf from './resources/aggregatorDataProviderConf.json';
import configEntryDataProviderConf from './resources/configEntryDataProviderConf.json';
import moment from 'moment';
import nanoScrollerSelector from 'nanoscroller';

var TYPE_MEDIATOR = 'mediator';
var TYPE_SEQUENCE = 'sequences';
var TYPE_ENDPOINT = 'endpoint';
var DASHBOARD_NAME = 'eianalytics';
var TYPE_PROXY = "proxy";
var TYPE_API = "api";
var TYPE_INBOUND_ENDPOINT = "inbound";
var TYPE_MESSAGE = "message";

var BASE_URL = getDashboardBaseUrl();

var MEDIATOR_PAGE_URL = BASE_URL + TYPE_MEDIATOR;
var SEQUENCE_PAGE_URL = BASE_URL + TYPE_SEQUENCE;
var ENDPOINT_PAGE_URL = BASE_URL + TYPE_ENDPOINT;

var centerDiv = {
    textAlign: 'center',
    verticalAlign: 'middle'
};

class MessageFlow extends Widget {
    constructor(props) {
        super(props);

        this.parameters = {
            timeFrom: null,
            timeTo: null,
            timeUnit: null,
            selectedComponantID: null,
            meta_tenantId: '-1234'
        };

        this.handleRecievedMessage = this.handleMessage.bind(this);

        this.state = {
            dataUnavailable: true,
            height: this.props.glContainer.height,
            width: this.props.glContainer.width
        };

        this.props.glContainer.on('resize', this.handleResize.bind(this));
    }

    handleResize() {
        this.setState({
            width: this.props.glContainer.width,
            height: this.props.glContainer.height
        });
    }

    /**
     * Given data array for a message flow, draw message flow in the svg component
     *
     * @param $ Jquery selector
     * @param data Data array for the message flow
     */
    drawMessageFlow($, data) {
        var hiddenLineStyle;
        if (this.detectIE() !== false) {
            hiddenLineStyle = 'display: none;';
        }
        else {
            hiddenLineStyle = 'stroke-width: 0px;';
        }
        if (data.length === 0) {
            $(this.domElementCanvas).html(this.getEmptyRecordsText());
            return;
        }
        var groups = [];
        $(this.domElementCanvas).empty();
        var nodes = data;

        // Create the input graph
        var g = new dagreD3.graphlib.Graph({compound: true})
            .setGraph({rankdir: "LR"})
            .setDefaultEdgeLabel(function () {
                return {};
            });

        for (var i = 0; i < nodes.length; i++) {
            if (nodes[i].id != null) {
                //Set Nodes
                if (nodes[i].type === "group") {
                    g.setNode(nodes[i].id, {label: "", clusterLabelPos: 'top'});

                    //Add arbitary nodes for group
                    g.setNode(nodes[i].id + "-s", {label: nodes[i].label, style: hiddenLineStyle});
                    // g.setEdge(nodes[i].id + "-s", nodes[i].id + "-e",  { style: 'display: none;; fill: #ffd47f'});
                    g.setNode(nodes[i].id + "-e", {label: "", style: hiddenLineStyle});
                    g.setParent(nodes[i].id + "-s", nodes[i].id);
                    g.setParent(nodes[i].id + "-e", nodes[i].id);

                    groups.push(nodes[i]);
                } else {
                    var label = this.buildLabel(nodes[i], $);
                    g.setNode(nodes[i].id, {labelType: "html", label: label});
                    // g.setNode(nodes[i].id, {label: nodes[i].label});
                }

                //Set Edges
                if (nodes[i].parents != null) {
                    for (var x = 0; x < nodes[i].parents.length; x++) {
                        var isParentGroup = false;
                        for (var y = 0; y < groups.length; y++) {
                            if (groups[y].id === nodes[i].parents[x] && groups[y].type === "group") {
                                isParentGroup = true;
                            }
                        }

                        if (nodes[i].type === "group") {
                            if (isParentGroup) {
                                g.setEdge(nodes[i].parents[x] + "-e", nodes[i].id + "-s", {
                                    lineInterpolate: 'basis',
                                    arrowheadClass: 'arrowhead'
                                });
                            } else {
                                g.setEdge(nodes[i].parents[x], nodes[i].id + "-s", {
                                    lineInterpolate: 'basis',
                                    arrowheadClass: 'arrowhead'
                                });
                            }
                        } else {
                            if (isParentGroup) {
                                g.setEdge(nodes[i].parents[x] + "-e", nodes[i].id, {
                                    lineInterpolate: 'basis',
                                    arrowheadClass: 'arrowhead'
                                });
                            } else {
                                g.setEdge(nodes[i].parents[x], nodes[i].id, {
                                    lineInterpolate: 'basis',
                                    arrowheadClass: 'arrowhead'
                                });
                            }
                        }
                    }
                }

                if (nodes[i].group != null) {
                    g.setParent(nodes[i].id, nodes[i].group);
                    if (nodes[i].type !== "group" && !this.isParent(nodes, nodes[i])) {
                        g.setEdge(nodes[i].group + "-s", nodes[i].id, {style: hiddenLineStyle});
                        g.setEdge(nodes[i].id, nodes[i].group + "-e", {style: hiddenLineStyle});
                    }


                }

            }

        }

        g.nodes().forEach(function (v) {
            var node = g.node(v);

            node.rx = node.ry = 7;
        });

        // Create the renderer
        var render = new dagreD3.render();

        $(this.domElementSvg).empty();

        var svg = d3.select(this.domElementSvg);
        svg.append("g");
        var inner = svg.select("g"),
            zoom = d3.zoom().on("zoom", function () {
                svg.select('g').attr("transform", d3.event.transform)
            });

        svg.call(zoom);
        var nanoScrollerSelector = $(this.domElementNano);
        nanoScrollerSelector.nanoScroller();
        inner.call(render, g);

        // Zoom and scale to fit
        var graphWidth = g.graph().width + 10;
        var graphHeight = g.graph().height + 10;
        var width = this.state.width;
        var height = this.state.height;
        var zoomScale = Math.min(width / graphWidth, height / graphHeight);
        var translate = [0, 0];

        svg.transition().duration(750).call(zoom.transform, d3.zoomIdentity.scale(zoomScale));
        svg.attr('width', width);
        svg.attr('height', height);
        // todo: Fix zooming for buttons
        d3.selectAll(this.domElementBtnZoomIn).on('click', function () {
            zoomScale += 0.05;
            this.interpolateZoom(translate, zoomScale, inner, zoom);
        });

        d3.selectAll(this.domElementBtnZoomOut).on('click', function () {
            if (zoomScale > 0.05) {
                zoomScale -= 0.05;
                this.interpolateZoom(translate, zoomScale, inner, zoom);
            }

        });

        d3.selectAll(this.domElementBtnZoomFit).on('click', function () {
            var zoomScale = Math.min(width / graphWidth, height / graphHeight);
            var translate = [(width / 2) - ((graphWidth * zoomScale) / 2), (height / 2) - ((graphHeight * zoomScale) / 2) * 0.93];
            zoom.translate(translate);
            zoom.scale(zoomScale);
            zoom.event(svg);
        });
    }

    /**
     * Extract most recent entry point message flow data array for a given component from the database for
     * proxy, api and inbound endpoint message flows
     *
     * @param timeFrom Time duration start position
     * @param timeTo Time duration end position
     * @param timeUnit Per which time unit, data should be retrieved(minutes, seconds etc)
     * @param entryName Name of the component
     * @param pageType Page name required for the message flow drawing
     */
    drawEntryPointMessageFlowGraph(timeFrom, timeTo, timeUnit, entryName, tenantId) {

        // Extract latest configEntry data row from the datastore
        this.setState({
            dataUnavailable: true
        });
        this.callBackFunction = this.handleConfigEntryData(timeUnit, timeFrom, timeTo, tenantId, entryName).bind(this);
        let query = this.getConfigEntryDataProviderConf(entryName, tenantId, timeFrom, timeTo);
        console.log(JSON.stringify(query));
        super.getWidgetChannelManager().subscribeWidget(
            this.props.id,
            this.callBackFunction,
            query
        );
    }

    getConfigEntryDataProviderConf(entryName, meta_tenantId, timeFrom, timeTo) {
        let dataProviderConfigs = this.getProviderConf(configEntryDataProviderConf);
        let query = dataProviderConfigs.configs.config.queryData.query;
        query = query
            .replace("{{entryName}}", entryName)
            .replace("{{meta_tenantId}}", meta_tenantId)
            .replace("{{timeFrom}}", timeFrom)
            .replace("{{timeTo}}", timeTo)
        console.warn(timeFrom, timeTo);
        dataProviderConfigs.configs.config.queryData.query = query;
        return dataProviderConfigs;
    }

    getAggregateDataProviderConf(timeUnit, timeFrom, timeTo, tenantId, hashcode) {
        let dataProviderConfigs = this.getProviderConf(aggregatorDataProviderConf);
        let query = dataProviderConfigs.configs.config.queryData.query;
        query = query
            .replace("{{timeUnit}}", timeUnit)
            .replace("{{hashcode}}", '\'' + hashcode + '\'')
            .replace("{{tenantId}}", tenantId)
            .replace("{{timeTo}}", timeTo)
            .replace("{{timeFrom}}", timeFrom)
        console.warn(query);
        dataProviderConfigs.configs.config.queryData.query = query;
        return dataProviderConfigs;
    }

    handleConfigEntryData(timeUnit, timeFrom, timeTo, tenantId, entryName) {
        return function (configEntryData) {
            if (configEntryData) {
                let hashcodeIndex = configEntryData.metadata.names.indexOf("hashcode");

                let hashcodeData = configEntryData.data[0][hashcodeIndex];
                this.getWidgetChannelManager().subscribeWidget(
                    this.props.id,
                    this.handleAggregateData(configEntryData, entryName).bind(this),
                    this.getAggregateDataProviderConf(timeUnit, timeFrom, timeTo, tenantId, hashcodeData)
                );
            } else {
                // todo: Handle missing configEntry data
            }
        }
    }

    handleAggregateData(configEntryData, entryName) {
        return function (aggregateData) {
            if (aggregateData) {
                this.setState({
                    dataUnavailable: false
                });
                // Read and store column names and the position mapping in the data arrays
                let configEntryDataTableIndex = {};
                configEntryData.metadata.names.forEach((value, index) => {
                    configEntryDataTableIndex[value] = index;
                })

                // console.log(aggregateData);
                let schema = JSON.parse(configEntryData.data[0][configEntryDataTableIndex["configData"]]);

                // Aggregate table and prepare component map
                var result = [];
                var componentMap = {};
                var fields = ["invocations", "totalDuration", "maxDuration", "faults"];
                var table = aggregateData.data;
                if (table != null && table.length !== 0) {
                    for (var j = 0; j < table.length; j++) {
                        var componentInfo = {};

                        // Replace number based indexing with label names
                        var row = table[j];
                        aggregateData.metadata.names.forEach((value, index) => {
                            componentInfo[value] = row[index];
                        })
                        var componentId = componentInfo["componentId"];
                        if (componentMap[componentId] == null) {
                            componentMap[componentId] = componentInfo;
                        } else {
                            for (var field in fields) {
                                fieldName = fields[field];
                                componentMap[componentId][fieldName] = componentMap[componentId][fieldName]
                                    + componentInfo[fieldName];
                            }
                        }
                    }
                }

                // Populate table data
                var componentNameRegex = new RegExp("^.*@\\d*:(.*)"); // Eg: HealthCareAPI@9:Resource
                var groups = [];
                for (var i = 0; i < schema.length; i++) {
                    var groupLabel;
                    if (schema[i] != null) {
                        var groupId = schema[i]["group"];
                        var componentId = schema[i]["id"];


                        /** change component id when @indirect presents **/
                        var isIndirectComponent = componentId.indexOf("@indirect"); // todo:Clarify

                        var originalCompId = componentId;

                        if (isIndirectComponent > 0) {

                            // PaymentServiceEp@14:PaymentServiceEp@indirect --> PaymentServiceEp@0:PaymentServiceEp

                            var splitByAt = componentId.split("@"); // ["PaymentServiceEp", "14:PaymentServiceEp", "indirect"]
                            var splitByColon = splitByAt[1].split(":"); // ["14", "PaymentServiceEp"]

                            componentId = splitByAt[0] + "@0:" + splitByColon[1];
                            /*
                                If any remaining entries in the schema has same name part'indirect',
                                replace it with the newly generated component id
                             */
                            for (var j = 0; j < schema.length; j++) {
                                if (schema[j] != null) {
                                    var componentIdTmp = schema[j]["id"];
                                    var componentIdParentTmp = schema[j]["parentId"];
                                    var tempGroupId = schema[j]["group"];
                                    if (componentIdTmp === componentId) {
                                        schema[j]["id"] = originalCompId;
                                    } else if (componentIdParentTmp === componentId) {
                                        schema[j]["parentId"] = originalCompId;
                                    }
                                    if (tempGroupId === componentId) {
                                        schema[j]["group"] = originalCompId;
                                    }
                                }
                            }
                        }


                        var componentInfo = componentMap[componentId];
                        var dataAttributes = [];

                        // Find unique groups
                        if (schema[i]["group"] != null && groups.indexOf(schema[i]["group"]) === -1) {
                            groups.push(schema[i]["group"]);
                        }

                        // Create data attributes
                        for (var field in fields) {
                            var fieldName = fields[field];
                            if (componentInfo != null) {
                                if (fieldName === "totalDuration") {
                                    dataAttributes.push({ // Get the average values of multiple entries of the same path
                                        "name": "AvgDuration",
                                        "value": (componentInfo[fieldName] / componentInfo["invocations"]).toFixed(2)
                                    });
                                } else {
                                    dataAttributes.push({"name": fieldName, "value": componentInfo[fieldName]});
                                }
                            } else {
                                dataAttributes.push({"name": fieldName, "value": 0});
                            }
                        }

                        var componentLabel = componentNameRegex.exec(componentId)[1];
                        if (componentInfo != null) {
                            var componentType = componentInfo["componentType"];
                        } else {
                            componentType = "UNKNOWN";
                        }

                        // Create hidden attributes
                        var hiddenAttributes = [];
                        hiddenAttributes.push({"name": "entryPoint", "value": entryName.slice(1, -1)});
                        if (componentType === "Endpoint" || componentType === "Sequence") {
                            hiddenAttributes.push({"name": "id", "value": componentLabel});
                        } else {
                            hiddenAttributes.push({"name": "id", "value": componentId});
                        }

                        if (schema[i]["parentId"] === schema[i]["group"]) {
                            result.push({
                                "id": originalCompId,
                                "label": componentLabel,
                                "parents": [],
                                "group": schema[i]["group"],
                                "type": componentType,
                                "dataAttributes": dataAttributes,
                                "hiddenAttributes": hiddenAttributes,
                                "modifiedId": componentId
                            });
                        } else {
                            result.push({
                                "id": originalCompId,
                                "label": componentLabel,
                                "parents": [schema[i]["parentId"]],
                                "group": schema[i]["group"],
                                "type": componentType,
                                "dataAttributes": dataAttributes,
                                "hiddenAttributes": hiddenAttributes,
                                "modifiedId": componentId
                            });
                        }
                    }
                }
                // Defining groups
                for (var j = 0; j < result.length; j++) {
                    if (groups.indexOf(result[j]["id"]) >= 0) {
                        result[j]["type"] = "group";
                    }
                }

                // Draw message flow with the processed data
                this.drawMessageFlow($, result);
            } else {
                // todo : handle this no data returned situation
            }
        }
    }

    /**
     * Draw graph for a flow of a message using the unique messageFlowID for the message.
     * @param messageFlowID Unique ID for the message flow
     * @param tenantId Tenant ID in a multiple tenant scenario
     */
    drawMessageFlowGraph(messageFlowID, tenantId) {
        // Set graph status to blank
        this.setState({
            dataUnavailable: true
        });

        // Set message flow id and make db call
        super.getWidgetConfiguration(this.props.widgetID)
            .then((message) => {
                let dataProviderConf = message.data;
                var query = dataProviderConf.configs.providerConfig.configs.config.queryData
                    .MESSAGE_FLOW_QUERY_GET_COMPONENTS;
                let formattedQuery = query
                    .replace("{{messageFlowId}}", "\'" + messageFlowID + "\'")
                    .replace("{{meta_tenantId}}", tenantId);
                dataProviderConf.configs.providerConfig.configs.config.queryData.query = formattedQuery;
                super.getWidgetChannelManager()
                    .subscribeWidget(
                        this.props.id,
                        this.handleMessageFlowComponentsData(tenantId).bind(this),
                        dataProviderConf.configs.providerConfig
                    );
            })
            .catch((error) => {
                // todo: Handle failure
            });
    }

    /**
     *  Parse message flow components data and get schema for the message flow id
     */
    handleMessageFlowComponentsData(tenantId) {
        return (components) => { // todo : If empty data came from the db, handle that situation
            let parsedComponents = this.parseDatastoreMessage(components);
            var entryPointHashCode = parsedComponents[0].entryPointHashcode;
            var entryPoint = parsedComponents[0].entryPoint;

            // Set query for schema and call datastore for data
            super.getWidgetConfiguration(this.props.widgetID)
                .then((message) => {
                    let dataProviderConf = message.data;
                    var query = dataProviderConf.configs.providerConfig.configs.config.queryData
                        .MESSAGE_FLOW_QUERY_GET_FLOW_SCHEMA;
                    let formattedQuery = query
                        .replace("{{hashcode}}", "\'" + entryPointHashCode + "\'")
                        .replace("{{meta_tenantId}}", tenantId);
                    dataProviderConf.configs.providerConfig.configs.config.queryData.query = formattedQuery;
                    super.getWidgetChannelManager()
                        .subscribeWidget(
                            this.props.id,
                            this.handleMessageFlowSchema(parsedComponents, entryPoint, tenantId).bind(this),
                            dataProviderConf.configs.providerConfig
                        );
                })
                .catch((error) => {
                    // todo: Handle failure
                });
        };
    }

    /**
     * Parse message flow schema and Get schemas for any existing sequences in the components
     */
    handleMessageFlowSchema(parsedComponents, entryPoint, tenantId) {
        return (flowSchema) => {
            let parsedFlowScheme = this.parseDatastoreMessage(flowSchema);
            let sequenceComponentsQuery = "("; // Query for Components which are sequences
            parsedComponents.forEach((value) => {
                if (value.componentType === "Sequence") {
                    // sequenceComponentsQuery += ("hashcode=='" + value.hashCode + "' OR "); // todo: Uncomment this
                }
            })

            // If sequences exists
            if (sequenceComponentsQuery.length > 0) { // todo: Test this scenario with sequence components
                //sequenceComponentsQuery += "false) "; // To fix final 'OR' in the query
                sequenceComponentsQuery += "true)"; // todo: Uncomment this

                super.getWidgetConfiguration(this.props.widgetID)
                    .then((message) => {
                        let dataProviderConf = message.data;
                        var query = dataProviderConf.configs.providerConfig.configs.config.queryData
                            .MESSAGE_FLOW_QUERY_GET_COMPONENT_SCHEMA;
                        let formattedQuery = query
                            .replace("{{sequences}}", sequenceComponentsQuery)
                            .replace("{{meta_tenantId}}", tenantId);
                        dataProviderConf.configs.providerConfig.configs.config.queryData.query = formattedQuery;
                        super.getWidgetChannelManager()
                            .subscribeWidget(
                                this.props.id,
                                this.handleMessageFlowComponentSchemas(parsedComponents, entryPoint, parsedFlowScheme).bind(this),
                                dataProviderConf.configs.providerConfig
                            );
                    })
                    .catch((error) => {
                        // todo: Handle failure
                    });
            }
            else {
                this.handleMessageFlowComponentSchemas(parsedComponents, entryPoint, parsedFlowScheme)("");
            }
        }
    }

    /**
     * Parse message flow schemas for sequence components and replace sequences with proper schemas
     * to build the message flow data. Then call graph draw function
     *
     * @param parsedComponents
     * @param entryPoint
     * @param parsedFlowScheme
     * @returns {Function}
     */
    handleMessageFlowComponentSchemas(parsedComponents, entryPoint, flowScheme) {
        return (sequenceComponents) => {
            let parsedFlowScheme = JSON.parse(flowScheme[0].configData);
            let componentMap = {};
            let parsedSequenceComponents = [];
            if (sequenceComponents !== ""){
                parsedSequenceComponents = this.parseDatastoreMessage(sequenceComponents);
            }

            parsedComponents.forEach((component) => {
                if (component.componentType === "Sequence") {
                    // Find this sequence config data from the sequence components
                    for (let sequence of parsedSequenceComponents) {
                        if (sequence.hashcode === component.hashCode) {
                            // For each element in the sequence scheme, push it to the parsed flow scheme
                            value.configData.forEach((eachScheme) => {
                                parsedFlowScheme.push(eachScheme);
                            })
                            break;
                        }
                    }
                }
                componentMap[component.componentId] = component;
            })

            let result = [];
            let tmpResult = [];
            // Generate final flow with the extracted data...
            var removedComponents = [];
            // Populate table data
            var componentNameRegex = new RegExp("^.*@\\d*:(.*)");
            var groups = [];
            var compIds = [];
            let schema = parsedFlowScheme;
            for (var i = 0; i < schema.length; i++) {
                var groupLabel;
                if (schema[i] != null) {
                    var groupId = schema[i]["group"];
                    var componentId = schema[i]["id"];

                    var isIndirectComponent = componentId.indexOf("@indirect");
                    var originalCompId = componentId;
                    if (isIndirectComponent > 0) {
                        // PaymentServiceEp@14:PaymentServiceEp@indirect --> PaymentServiceEp@0:PaymentServiceEp
                        var splitByAt = componentId.split("@"); // ["PaymentServiceEp", "14:PaymentServiceEp", "indirect"]
                        var splitByColon = splitByAt[1].split(":"); // ["14", "PaymentServiceEp"]
                        componentId = splitByAt[0] + "@0:" + splitByColon[1];
                        for (var j = 0; j < schema.length; j++) {
                            if (schema[j] != null) {
                                var componentIdTmp = schema[j]["id"];
                                var componentIdParentTmp = schema[j]["parentId"];
                                var tempGroupId = schema[j]["group"];
                                if (componentIdTmp == componentId) {
                                    schema[j]["id"] = originalCompId;
                                }
                                if (componentIdParentTmp == componentId){
                                    schema[j]["parentId"] = originalCompId;
                                }
                                if (tempGroupId == componentId) {
                                    schema[j]["group"] = originalCompId;
                                }
                            }
                        }
                    }

                    var componentInfo  = null;
                    if (componentId != null) {
                        componentInfo = componentMap[componentId];
                    }
                    var dataAttributes = [];
                    var hiddenAttributes = [];
                    var componentLabel = componentNameRegex.exec(componentId)[1];

                    // Find unique groups
                    if (schema[i]["group"] != null && groups.indexOf(schema[i]["group"]) == -1) {
                        groups.push(schema[i]["group"]);
                    }


                    // Create data attributes
                    if (componentInfo != null) {
                        dataAttributes.push({"name": "Duration", "value": componentInfo["duration"]});
                        if (componentInfo["faultCount"] == 0) {
                            dataAttributes.push({"name": "Status", "value": "Success"});
                        } else {
                            dataAttributes.push({"name": "Status", "value": "Failed"});
                        }
                        var componentType = componentInfo["componentType"];
                        var hashCode = componentInfo["hashCode"];

                        hiddenAttributes.push({"name": "entryPoint", "value": entryPoint});
                        hiddenAttributes.push({"name": "hashCode", "value": hashCode});

                        // for Sequences and Endpoints, id should be the "name", since name is used for drill down searches
                        if (componentType == "Endpoint" || componentType == "Sequence") {
                            hiddenAttributes.push({"name": "id", "value": componentLabel});
                        } else {
                            hiddenAttributes.push({"name": "id", "value": componentId});
                        }

                        var compId = schema[i]["id"];
                        var parentId = schema[i]["parentId"];
                        if (compIds.indexOf(compId) < 0) {
                            compIds.push(compId);
                        }
                        if (parentId != null && (compIds.indexOf(parentId) < 0)) {
                            var matchingParentId;

                            // This logic traverse towards the root of the configuration tree from
                            // the current node, until it finds the parent of the node or any ancestor node
                            // exists within the message flow. If any node found, it assigns the node as
                            // its parent.  This link is used to draw the message flow.
                            for (var j = 1; j < schema.length; j++) {
                                if (compIds.indexOf(schema[i - j]["parentId"]) != -1) {
                                    matchingParentId = schema[i - j]["parentId"];
                                    break;
                                }
                            }
                            tmpResult.push({
                                "id": originalCompId,
                                "label": componentLabel,
                                "parents": [matchingParentId],
                                "group": schema[i]["group"],
                                "type": componentType,
                                "dataAttributes": dataAttributes,
                                "hiddenAttributes": hiddenAttributes,
                                "modifiedId": componentId
                            });
                        } else if (schema[i]["parentId"] == schema[i]["group"]) {
                            tmpResult.push({
                                "id": originalCompId,
                                "label": componentLabel,
                                "parents": [],
                                "group": schema[i]["group"],
                                "type": componentType,
                                "dataAttributes": dataAttributes,
                                "hiddenAttributes": hiddenAttributes,
                                "modifiedId": componentId
                            });
                        } else {
                            tmpResult.push({
                                "id": originalCompId,
                                "label": componentLabel,
                                "parents": [schema[i]["parentId"]],
                                "group": schema[i]["group"],
                                "type": componentType,
                                "dataAttributes": dataAttributes,
                                "hiddenAttributes": hiddenAttributes,
                                "modifiedId": componentId
                            });
                        }
                    } else {
                        removedComponents.push(componentId);
                    }
                }
            }
            compIds = null;

            // Cleanup
            for (var k = 0; k < tmpResult.length; k++) {
                var group = tmpResult[k]["group"];
                var parentId = tmpResult[k]["parents"];
                if (removedComponents.indexOf(group) == -1 && removedComponents.indexOf(parentId[0]) == -1) {
                    result.push(tmpResult[k]);
                }
            }


            for (var j = 0; j < result.length; j++) {
                if (groups.indexOf(result[j]["id"]) >= 0) {
                    result[j]["type"] = "group";
                }
            }

            // Draw graph
            this.drawMessageFlow($, result);
        }
    }

    /**
     * Parse received data from the data store to a JS object
     */
    parseDatastoreMessage(recievedData) {
        let parsedArray = [];
        let dataMapper = {};

        let dataArray = recievedData.data;
        let metaData = recievedData.metadata.names;

        metaData.forEach((value, index) => {
            dataMapper[index] = value;
        });
        dataArray.forEach((dataPoint) => {
            let parsedObject = {};
            dataPoint.forEach((value, index) => {
                parsedObject[dataMapper[index]] = value;
            });
            parsedArray.push(parsedObject);
        })

        return parsedArray;
    }

    getProviderConf(aggregatorDataProviderConf) {
        let stringifiedDataProvideConf = JSON.stringify(aggregatorDataProviderConf);
        return JSON.parse(stringifiedDataProvideConf);
    }

    detectIE() {
        var ua = window.navigator.userAgent;

        var msie = ua.indexOf('MSIE ');
        if (msie > 0) {
            // IE 10 or older => return version number
            return parseInt(ua.substring(msie + 5, ua.indexOf('.', msie)), 10);
        }

        var trident = ua.indexOf('Trident/');
        if (trident > 0) {
            // IE 11 => return version number
            var rv = ua.indexOf('rv:');
            return parseInt(ua.substring(rv + 3, ua.indexOf('.', rv)), 10);
        }

        var edge = ua.indexOf('Edge/');
        if (edge > 0) {
            // Edge (IE 12+) => return version number
            return parseInt(ua.substring(edge + 5, ua.indexOf('.', edge)), 10);
        }

        // other browser
        return false;
    }

    buildLabel(node, $) {
        var pageUrl = MEDIATOR_PAGE_URL;
        if (node.type === "Sequence") {
            pageUrl = SEQUENCE_PAGE_URL;
        } else if (node.type === "Endpoint") {
            pageUrl = ENDPOINT_PAGE_URL;
        }
        var hashCode = "";
        var hiddenParams = '';
        if (node.hiddenAttributes) {
            node.hiddenAttributes.forEach(function (item, i) {
                hiddenParams += '&' + item.name + '=' + item.value;
                if (item.name === "hashCode") {
                    hashCode = item.value;
                }
            });
        }
        var targetUrl = pageUrl + '?' + hiddenParams;
        // console.log("Test : " + targetUrl);
        var labelText;

        if (node.dataAttributes) {
            var nodeClasses = "nodeLabel";
            var nodeWrapClasses = "nodeLabelWrap"

            if (node.dataAttributes[1].value === "Failed") {
                nodeClasses += " failed-node";
                nodeWrapClasses += " failed-node";

            }
            var icon;
            if (node.type.toLowerCase() === 'mediator') {

                var mediatorName = node.label.split(':')[0].toLowerCase();

                var imgURL = '/portal/public/app/images/mediators/' + mediatorName + '.svg';
                var defaultImgURL = '/portal/public/app/images/mediators/mediator.svg';

                icon = '<img class="mediator-icon" src="' + imgURL + '" onerror="this.src="' + defaultImgURL + '">';
            } else if (node.type.toLowerCase() === 'endpoint') {
                icon = '<i class="icon endpoint-icon fw fw-endpoint"></i>';
            } else {
                icon = '';
            }

            // todo: Add functionality to the target URL(When a node is clicked, add necessary functionality)
            labelText = '<a href="#" class="' + nodeWrapClasses + '">' + icon + '<div class="' + nodeClasses + '" data-node-type="' + node.type + '" data-component-id="' + node.modifiedId
                + '" data-hash-code="' + hashCode + '" data-target-url="' + targetUrl + '"><h4>' + node.label + "</h4>";

            node.dataAttributes.forEach(function (item, i) {
                labelText += "<h5><label>" + item.name + " : </label><span>" + item.value + "</span></h5>";
            });
        }
        labelText += "</div></a>";
        return labelText;
    };

    interpolateZoom(translate, scale, svg, zoom) {
        //var self = this;
        return d3.transition().duration(350).tween("zoom", function () {
            var iTranslate = d3.interpolate(zoom.translate(), translate),
                iScale = d3.interpolate(zoom.scale(), scale);
            return function (t) {
                zoom.scale(iScale(t)).translate(iTranslate(t));
                svg.attr("transform", d3.event.transform)
            };
        });
    }

    isParent(searchNodes, id) {
        for (var x = 0; x < searchNodes.length; x++) {
            if (searchNodes[x].parent === id) {
                return true;
            }
        }
        return false;
    }

    getEmptyRecordsText() {
        return '<div class="status-message">' +
            '<div class="message message-info">' +
            '<h4><i class="icon fw fw-info"></i>No records found</h4>' +
            '<p>Please select a valid date range to view stats.</p>' +
            '</div>' +
            '</div>';
    };

    componentWillMount() {
        super.subscribe(this.handleRecievedMessage);
    }

    componentDidMount() {
        this.drawMessageFlowGraph("urn_uuid_b4d2bd01-b44c-44c2-83ec-d3ada2c103dc57090651967469", "-1234");
    }

    handleMessage(recievedMessage) {
        console.log(JSON.stringify(message));
        let message;
        if (typeof recievedMessage == "string") {
            message = JSON.parse(recievedMessage);
        }
        else {
            message = recievedMessage;
        }

        if ("granularity" in message) {
            this.parameters.timeFrom = '\'' + moment(message.from).format("YYYY-MM-DD HH:mm:ss") + '\'';
            this.parameters.timeTo = '\'' + moment(message.to).format("YYYY-MM-DD HH:mm:ss") + '\'';
            this.parameters.timeUnit = '\'' + message.granularity + 's' + '\'';
        }

        if ("selectedComponent" in message) {
            this.parameters.selectedComponantID = '\'' + message.selectedComponent + '\'';
        }

        $(this.domElementSvg).empty();

        if (this.parameters.timeFrom != null
            && this.parameters.timeTo != null
            && this.parameters.timeUnit != null
            && this.parameters.selectedComponantID != null) {

            this.drawEntryPointMessageFlowGraph(
                this.parameters.timeFrom,
                this.parameters.timeTo,
                this.parameters.timeUnit,
                this.parameters.selectedComponantID,
                this.parameters.meta_tenantId
            );
        }
    }

    noParameters() {
        var page = this.getCurrentPage();
        let pageName = page == null ? '' : page.name;
        switch (pageName) {
            case 'api':
                return 'Please select an API and a valid date range to view stats.';
                break;
            case 'proxy':
                return 'Please select a Proxy Service and a valid date range to view stats.';
                break;
            case 'sequences':
                return 'Please select a Sequence and a valid date range to view stats.';
                break;
            case 'endpoint':
                return 'Please select an Endpoint and a valid date range to view stats.';
                break;
            case 'inboundEndpoint':
                return 'Please select an Inbound Endpoint and a valid date range to view stats.';
                break;
            default:
                return 'Please select a valid date range to view stats';
        }
        ;
    }

    getCurrentPage() {
        var pageName;
        var href = parent.window.location.href;
        var lastSegment = href.substr(href.lastIndexOf('/') + 1);
        if (lastSegment.indexOf('?') === -1) {
            pageName = lastSegment;
        } else {
            pageName = lastSegment.substr(0, lastSegment.indexOf('?'));
        }
        return pageName;
    };

    render() {
        return (
            <body>
            <div className="nano" ref={input => (this.domElementNano = input)}>
                <div className="nano-content">
                    <div className="page-content-wrapper">
                        <div className="zoom-panel">
                            <button className="btn-zoom" id="btnZoomIn"
                                    ref={input => (this.domElementBtnZoomIn = input)}>+
                            </button>
                            <br/>
                            <button className="btn-zoom" id="btnZoomOut"
                                    ref={input => (this.domElementBtnZoomOut = input)}>-
                            </button>
                            <br/>
                            <button className="btn-zoom" id="btnZoomFit"
                                    ref={input => (this.domElementBtnZoomFit = input)}>
                                <i className="fw fw-square-outline"></i>
                            </button>
                        </div>
                        <div id="canvas" ref={input => (this.domElementCanvas = input)}>
                            {this.state.dataUnavailable === true ?
                                <div class="status-message">
                                    <div class="message message-info">
                                        <h4 style={centerDiv}>
                                            <i class="icon fw fw-info"></i> No records found</h4>
                                        <p style={centerDiv}>{this.noParameters()}</p>
                                    </div>
                                </div> : null}
                        </div>
                        <svg id="svg-canvas" width="100%" height="100%"
                             ref={input => (this.domElementSvg = input)}></svg>
                    </div>
                </div>
            </div>
            </body>
        );
    }
}

function getDashboardBaseUrl() {
    var currentUrl = window.parent.location.href;
    var BaseUrlRegex = new RegExp(".*?(portal.*dashboards)");
    var tenantBaseUrl = BaseUrlRegex.exec(currentUrl)[1];
    return "/" + tenantBaseUrl + "/" + DASHBOARD_NAME + "/";
}

global.dashboard.registerWidget('MessageFlow', MessageFlow);