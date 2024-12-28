import { MetricsPanelCtrl } from 'app/plugins/sdk';
import _ from 'lodash';
import kbn from 'app/core/utils/kbn';

import echarts from './libs/echarts.min';
import './libs/dark';
import './style.css!';
import './libs/china.js';
import './libs/bmap.js';
import './libs/getBmap.js';

import DataFormatter from './data_formatter';



export class Controller extends MetricsPanelCtrl {

    constructor($scope, $injector) {
        super($scope, $injector);

        const panelDefaults = {
            EchartsOption: 'option = {};',
            IS_UCD: false,
            METHODS: ['POST', 'GET'],
            ETYPE: ['line', 'pie', 'map'],
            url: '',
            method: 'POST',
            upInterval: 60000,
            esMetric: 'Count'
        };

        _.defaults(this.panel, panelDefaults);

        this.dataFormatter = new DataFormatter(this, kbn);

        this.events.on('data-received', this.onDataReceived.bind(this));
        this.events.on('data-error', this.onDataError.bind(this));
        this.events.on('data-snapshot-load', this.onDataReceived.bind(this));
        this.events.on('init-edit-mode', this.onInitEditMode.bind(this));
        this.events.on('panel-initialized', this.render.bind(this));

        this.refreshData();
    }


    onDataReceived(dataList) {

        this.data = this.panel.IS_UCD ? this.customizeData : dataList;

        // ES 数据 可以把这个打开，把下面的注释掉
        // if (this.panel.type == 'grafana-echarts-panel') {
        //     var data = [];
        //     this.dataFormatter.setGeohashValues(dataList, data);
        //     this.data = this.dataFormatter.aggByProvince(data);
        // }

        if (this.panel.type === 'grafana-echarts-panel') {
            console.log('Data received:', dataList);
            let data = [];
            function cleanRegionName(name) {
                return name.replace(/(市|省|维吾尔自治区|壮族自治区|回族自治区|自治区|特别行政区)$/, '');
            }
            // 处理Loki数据格式
            if (dataList && dataList.length > 0) {
                dataList.forEach(series => {
                    // 从alias或target中提取城市名
                    const provinceMatch = (series.alias || series.target || '').match(/Province="([^"]+)"/);
                    if (provinceMatch) {
                        const provinceName = cleanRegionName(provinceMatch[1]);  // 清理后缀
                        // 获取数据点的值（取最新的一个数据点）
                        const value = series.datapoints && series.datapoints.length > 0 ? series.datapoints[0][0] : 0;
                        
                        data.push({
                            name: this.dataFormatter.getRegoinName(provinceName) || provinceName,
                            value: value
                        });
                    }
                });
            }
            console.log('Processed data:', data);
            this.panel.data = data;
            this.data = data;
        }
        this.refreshed = true;
        this.render();
        this.refreshed = false;
    }


    onDataError(err) {
        this.render();
    }


    onInitEditMode() {
        this.addEditorTab('Customize Data', 'public/plugins/grafana-echarts-panel/partials/editor-ds.html', 2);
        this.addEditorTab('Echarts Option', 'public/plugins/grafana-echarts-panel/partials/editor-echarts.html', 3);
    }


    refreshData() {
        let _this = this, xmlhttp;

        if (window.XMLHttpRequest) {
            xmlhttp = new XMLHttpRequest();
        } else {
            xmlhttp = new ActiveXObject("Microsoft.XMLHTTP");
        }

        let data = [];
        xmlhttp.onreadystatechange = function () {
            if (xmlhttp.readyState == 4 && xmlhttp.status == 200) {
                _this.customizeData = JSON.parse(xmlhttp.responseText);
                _this.onDataReceived();
            }
        };

        if (this.panel.IS_UCD) {
            xmlhttp.open(_this.panel.method, _this.panel.url, true);
            xmlhttp.send();
        } else {
            xmlhttp = null;
        }

        this.$timeout(() => { this.refreshData(); }, _this.panel.upInterval);
    }


    getPanelPath() {
        // the system loader preprends publib to the url, add a .. to go back one level
        return '../' + grafanaBootData.settings.panels[this.pluginId].baseUrl + '/';
    }


    link(scope, elem, attrs, ctrl) {
        const $panelContainer = elem.find('.echarts_container')[0];
        let option = {}, echartsData = [];

        ctrl.refreshed = true;

        function setHeight() {
            let height = ctrl.height || panel.height || ctrl.row.height;
            if (_.isString(height)) {
                height = parseInt(height.replace('px', ''), 10);
            }

            $panelContainer.style.height = height + 'px';
        }

        setHeight();

        let myChart = echarts.init($panelContainer, 'dark');

        setTimeout(function () {
            myChart.resize();
        }, 1000);

        var callInterval = function callInterval() {
            var timeout, result;

            function func(callBack, interval) {
                var context = this; // jshint ignore:line
                var args = arguments;

                if (timeout) clearInterval(timeout);

                timeout = setInterval(function () {
                    result = callBack.apply(context, args);
                }, interval);

                return result;
            }

            return func;
        }();

        function render() {

            if (!myChart) {
                return;
            }

            setHeight();
            myChart.resize();

            if (ctrl.refreshed) {
                myChart.clear();
                echartsData = ctrl.data;
                console.info("日志ctr1" + ctrl);
                eval(ctrl.panel.EchartsOption); // jshint ignore:line
                
                myChart.setOption(option);
                if (option.series[0].data.length == 0) {
                    option.series[0].data = ctrl.data;
                }
            }
            console.log('Echarts option:', option);  // 添加调试日志
        }

        this.events.on('render', function () {
            render();
            ctrl.renderingCompleted();
            console.info("日志ctr2" + ctrl);
        });
    }
}

Controller.templateUrl = 'partials/module.html';
