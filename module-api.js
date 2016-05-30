/*!
 * module-api v0.1
 * (c) 2016 Ning
 */
(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory(require("jquery")) :
    typeof define === 'function' && define.amd ? define(['jquery'], factory):
    global.ModuleApi = factory();
}(this, function ($) {
    'use strict';

    // 服务配置信息
    var options = {
        platform: function(projectName) {

            if (projectName.indexOf("http") === 0) return projectName;

            var onlineDomain = "onlineDomain.com", testDomain = "testDomain.com";
            var platformUrl = "http://" + projectName + "." + (location.host.indexOf("testDomain.com") >= 0 ? onlineDomain : testDomain);
            return platformUrl;
        },
        httpMethods: { GET: "GET", POST: "POST", PUT: "PUT", PATCH: "PATCH", DELETE: "DELETE" },
        contentTypes: { JSON: 'application/json', FORM: 'application/x-www-form-urlencoded', HTML: 'text/html' },
        modules: {

            // 自己模块（需要模块自己初始化）
            self: {
                appid: window.appid  //协同脚本中定义
            }
        },

        cache: {
            localServer: { path: 'Home', action: 'CacheKeyTime' }   //本地缓存更新地址
        }

    };

    var modules = options.modules;


    // 测试模块（邮件）
    modules.email = {
        apis: {
            "sendEmail": { action: "sendEmail", disc: "发送邮件" }
        },
        links: {
            "sendPage": ":path/Email/sendEmail?user=:userId&appId=:appid"
        },
        appid: "1",
        path: options.platform("test.app")
    };

    function warn(msg) {
        window.console && console.warn('[module-api] ' + msg);
    }

    /************** ModuleApi **************/

    var _ModuleApi = null;

    /**
     * 默认可设置服务地址 和  Headers
     */
    _ModuleApi = (function () {

        var httpMethods = options.httpMethods;
        var contentTypes = options.contentTypes;

        function typeFormat(value) {
            var type = Object.prototype.toString.call(value).replace("[object ", "").replace("]", "");
            return {
                type: type,
                string: type === "String",
                number: type === "Number",
                array: type === "Array",
                object: type === "Object",
                method: type === "Function",
                bool: type === "Boolean"
            };
        }

        /**
         * 替换路由参数
         * @param {} routerUrl 
         * @param {} params 
         * @returns {} 
         */
        function replaceRouterUrl(routerUrl, params) {
            for (var name in params) {
                if (params.hasOwnProperty(name)) {
                    routerUrl = routerUrl.replace(":" + name, params[name]);
                }
            }
            return routerUrl;
        };

        /**
         * 结果响应（支持 params.merge 自定义参数 ）
         * @param {Object} requestData 
         *      - {Function} success 
         *      - {Function} error 
         *      - {Json} data
         *               data.merge array: 合并请求共用参数( { names: [""], merge: "array" } ); 
         *                              obj: 合并请求自定义参数( names: { name1: "",  params1: { ... }, merge: "obj" } )
         * @returns {} 
         */
        function resultResponse(requestData, data) {

            var success = requestData.success;
            if (success) {
                var merge = requestData.data && requestData.data.merge;

                var ismerge = merge === "array" || merge === "obj";
                if (ismerge) {
                    if (data) {
                        // 拆分合并请求的结果集
                        for (var name in data) {
                            if (data.hasOwnProperty(name)) {
                                success(name, data[name]);
                            }
                        }
                    }
                } else {
                    success(data);
                }
            }

            // 延迟操作函数
            if (requestData.then) {
                var fnOutput = requestData.then(data);

                // 我的函数被上级托管了，在这里获取过来。
                requestData.thenFn && fnOutput._setNextFn(requestData.thenFn);

            }

        }

        /**
         * 结果过滤器（需要通用）
         * @param {} requestData 请求数据
         *      - success 成功响应函数
         *      - error 错误响应函数
         * @param {} inputResult 结果源
         * @returns {Object} 剥离后的包数据 
         */
        function resultFilter(requestData, inputResult) {

            var success = requestData.success;
            var error = requestData.error;
            var then = requestData.then;


            if (inputResult) {
                var format = typeFormat(inputResult);

                // 结果状态: { success: true, data: {  } } 
                if (format.object) {
                    if (inputResult.success) {
                        var data = inputResult.data || inputResult.result;
                        resultResponse(requestData, data);
                        return data;
                    }
                    else {
                        warn(inputResult.message);

                        // 请求响应的错误函数
                        if (error) {
                            error(inputResult.message || "未知异常");
                        } else {
                            _warning(inputResult.message || "未知异常");
                        }
                    }
                } else {
                    success && success(inputResult);

                    // 延迟操作函数
                    then && then(inputResult);

                    return inputResult;
                }
                
            }
            return null;
        }

        function registerModules() {
            var api = this;


            /**
             * 返回模块的接口调用
             * @returns {} 
             */
            var getModuleApi = function () {
                return api.path(this.path);
            }

            /**
             * 返回模块的接口调用，是一个全新模块
             * @returns {} 
             */
            var createModuleApi = function () {
                return new _ModuleApi().path(this.path);
            }

            var getApi = function(path) {
                return function() {
                    return api.path(path);
                };
            }

            var linkString = function(linkName, params) {
                var link = this.links[linkName];
                params = params || {};
                params.appid = this.appid;
                params.path = this.path;
                return link && replaceRouterUrl(link, params);
            }

            api._modules = {};



            //注册模块名称
            for (var moduleName in modules) {
                if (modules.hasOwnProperty(moduleName)) {
                    var module = null;

                    module = api._modules[moduleName] = modules[moduleName];
                    module.api = getModuleApi;
                    module.createApi = createModuleApi;
                    module.link = linkString;

                    if (!api.hasOwnProperty(moduleName) && api._modules.hasOwnProperty(moduleName)) {
                        Object.defineProperty(api, moduleName, {
                            get: getApi(module.path)
                        });
                    }
                }
            }

        }

        function registerRequestMethods() {
            var api = this;

            // 这是一些可以扩展的常用请求函数
            var requestMethods = {
                get: httpMethods.GET, // 获取（倾向于获取单个数据，综合业务）
                query: httpMethods.GET, // 查询（倾向于单纯查询数据）

                post: httpMethods.POST, // 不建议使用该请求（当请求类型不符合相应动作时，再使用。）
                'do': httpMethods.POST, // 做一个动作
                set: httpMethods.POST, // 设置一个属性
                add: httpMethods.POST, // 添加一个对象
                save: httpMethods.POST, // 保存一个对象

                put: httpMethods.PUT,
                patch: httpMethods.PATCH,

                "delete": httpMethods.DELETE, // 删除（不可从新设置的操作）
                remove: httpMethods.DELETE // 删除（可重新设置的删除操作）
            };

            function getRequestMethod(requestMethod) {
                return function (urlFragment, params, success, cache) {
                    return api.request({
                        type: requestMethods[requestMethod],
                        urlFragment: urlFragment,
                        data: params,
                        success: success,
                        cache: cache,
                        requestMethod: requestMethod    // 更详细的请求函数（不知道命名是否合适）
                    });
                }
            }

            for (var requestMethod in requestMethods) {
                api[requestMethod] = getRequestMethod(requestMethod);
            }
        }

        function appendUrl(path, action) {
            return path + (action ? (action.charAt(0)==="/" ? "" : "/") + action : "");
        }

        /**
         * 获取请求Url (this: ModuleApi Object)
         * @param {String | Array<String> | Object | Function} urlFragment 
         *              - {String} path 接口地址
         *              - {String} action 接口名称
         * @returns {} 
         */
        function getUrl(urlFragment) {
            var format = typeFormat(urlFragment);
            var url = this._path;

            urlFragment = urlFragment || "";

            if (format.string || format.number || format.bool) {
                // is string - 通用型，api 已经设置过全局 path 了,此处设置一个 action 即可。
                url = appendUrl(url, urlFragment);
            }

            if (format.array) {
                // is array - 一个数组片段，这样定义有点奇葩了，我是怎么想出来的。
                for (var i = 0; i < urlFragment.length; i++) {
                    url = appendUrl(url, urlFragment[i]);
                }
            }

            if (format.object) {
                // is object - 可能包含路由参数(未实现).
                //           - { path: "/:area/:controller/", action: "actionName.aspx?:type=:type", params: {} }
                if (urlFragment.path) {
                    url = appendUrl("", urlFragment.path);
                }
                if (urlFragment.action) {
                    url = appendUrl(url, urlFragment.action);
                }
            }

            if (format.method) {
                //既然是函数，就不继承了。
                url = format.method(this._path);
            }

            return url;
        };

        /**
         * 获取请求数据 (this: ModuleApi Object)
         * @param {} requestData 
         *              - {String} type
         *              - {Object | Array<Object> | String} data 一个或一组请求对象，请求时进行合并参数，便于前台请求参数分解。
         * @returns {} 
         */
        function getRequestData(requestData) {

            var format = typeFormat(requestData.data);

            var params = requestData.data;

            if (format.array) {
                // is array - 可能是多个参数组，在这里合并请求
                params = {};
                for (var i = 0; i < requestData.data.length; i++) {
                    $.extend(params, requestData.data[i]);
                }
            }

            if (requestData.type !== httpMethods.GET && this._contentType === contentTypes.JSON) {
                return JSON.stringify(params);
            } else {
                return params;
            }

        }

        /**
         * 
         * @param {Object} cache 'homesource 1m|h|d' 缓存关键字缓存时间
         * @returns {} 
         */
        function formatCacheCode(cache) {
        
            var code = {
                page: "page" //本次页面缓存   没有实现呢
            };
            code.m = 60000; //一分钟 
            code.h = code.m * 60; //一小时
            code.d = code.h * 24; //一天
            
            cache = cache ? cache.split(" ") : [];
            var cacheName = "";
            var cacheTime = 0;
            if (cache.length > 0) {
                var timecode = cache[cache.length===1 ? 0 : 1];
                var timemode = timecode[timecode.length - 1];
                var timenum = parseInt(timecode.substr(0, timecode.length - 1));
                cacheTime = timenum * code[timemode];
                if (cache.length > 1) {
                    cacheName = cache[0];
                }
            }

            var cacheData = $.ModuleApi.cacheData = $.ModuleApi.cacheData || { };
            if (cacheName) {
                var cacheItem = cacheData[cacheName] = cacheData[cacheName] || { firstCheck: true };
                cacheItem.cacheName = cacheName;
                cacheItem.cacheTime = cacheTime;
                return cacheItem;
            } else {
                return { cacheTime: cacheTime };
            }
        }

        /**
         * 读取本地缓存数据
         * @param {String} dataName 缓存名称
         * @param {Object} cache 'homesource 1m|h|d' 缓存关键字缓存时间
         */
        function localStorageByCacheTime(dataName, cache, dataString) {

            var cacheModel = formatCacheCode(cache);


            var nowTime = new Date().getTime();
            var baseKey = "api/cachedata/" + (cacheModel.cacheName || "default");

            var baseData = localStorage.getItem(baseKey);
            if (baseData) {
                baseData = JSON.parse(baseData);
            }
            if (!(baseData && baseData.dataNames)) {
                baseData = { storageTime: nowTime, dataSize: 0, dataNames: []};
            }            

            if (baseData.dataNames.indexOf(dataName) === -1) {
                baseData.dataNames.push(dataName);
            }

            var cacheTime = cacheModel.cacheTime;
            var cacheItem = baseData[dataName] || { time: 0 };

            
            var getDataAndWrite = function (clear) {

                if (clear) {
                    baseData = { storageTime: nowTime, dataSize: 0, dataNames: [dataName] }; // 其他缓存字段都失效
                }

                //写到本地存储介质中
                dataString && dataString(function (data) {

                    var dataStr = (typeof (data) === "string") ? data : JSON.stringify(data);
                    cacheItem.data = data;
                    cacheItem.time = nowTime;
                    cacheItem.dataSize = dataStr && dataStr.length;

                    baseData[dataName] = cacheItem;
                    baseData.dataSize = JSON.stringify(baseData).length;
                    baseData = JSON.stringify(baseData);

                    window.localStorage.setItem(baseKey, baseData);

                });
            }            

            if (cacheItem.time >= nowTime - cacheTime) {
                
                dataString && dataString(cacheItem.data);

                // 检查下缓存数据是否还有效
                if (cacheModel && cacheModel.cacheName && cacheModel.firstCheck) {
                    cacheModel.firstCheck = false;

                    $.ModuleApi().get(options.cache.localServer, { key: cacheModel.cacheName }, function (time) {
                        if (cacheItem.time < time) {
                            getDataAndWrite(true); // 那就更新下
                        }
                    });
                }

            } else {
                getDataAndWrite();
            }
        }

        /**
         * Api数据获取服务
         * @param {String} path 服务地址
         * @param {Object} params 服务参数
         * @returns {} 
         */
        function ModuleApi(path, params) {
            path = path || "";
            path = path.indexOf("/") === 0 || path.indexOf("http") === 0 ? path : "/" + path;

            var self = this;

            self.path(path, params);
            self._headers = {};
            self._contentType = contentTypes.JSON;
            
            registerModules.call(self);
            registerRequestMethods.call(self);

        }


        /**
         * 简单的Http操作回调函数。
         * @param {} requestData 
         * @param {} ajaxRequest 
         * @returns {} 
         */
        function fnOutputs(requestData, ajaxRequest) {
            return {
                _requestData: requestData,
                _thenFn: null,       // 延迟函数（响应函数）
                _setNextFn: function (thenFn) {
                    var _thenFn = thenFn._thenFn;

                    this._requestData.thenFn = _thenFn;

                    var fns = ["success", "error", "then", "cache"];
                    for (var i = 0; i < fns.length; i++) {
                        var fn = [fns[i]];
                        _thenFn._requestData[fn] && (this._requestData[fn] = _thenFn._requestData[fn]);
                    }

                },


                success: function (fnSuccess) { // 请求成功函数
                    requestData.success = fnSuccess;
                    return this;
                },
                error: function (fnError) { // 请求失败函数
                    requestData.error = fnError;
                    return this;
                },
                then: function (fnDone) { // 延迟函数

                    requestData.then = fnDone;
                    this._thenFn = fnOutputs({});

                    return this._thenFn;
                },
                cache: function (cacheFormat) {  // 缓存格式
                    requestData.cache = cacheFormat;
                },

                request: ajaxRequest // ajax 请求对象
            };
        };

        function loading(status) {
            if (status) {
                console.info("loading show");
            } else {
                console.info("loading close");
            }
        }

        ModuleApi.prototype = {

            /**
             * 获取模块
             * @param {} moduleName 
             * @returns {} 
             */
            module: function (moduleName) {
                return this._modules[moduleName];
            },

            /**
             * 是否登陆只人人通
             * @param {Boolean} jump  未登录是否直接进行登陆
             * @returns {} 
             */
            hasLogged: function (jump) {
                var loginPerson = $(".login_person");
                var spaceLogin = loginPerson.find(".space-login");
                var activeSpace = loginPerson.find(".active-space");

                // 没有登录
                if (spaceLogin.length) {
                    jump && (window.location.href = spaceLogin.attr("href"));
                    return false;
                }
                // 没有激活空间
                if (activeSpace.length) {
                    jump && (window.location.href = activeSpace.attr("href"));
                    return false;
                }

                return true;
            },
            

            /**
             * 
             *  
             * @param {Object} requestData 
             *                 - {String | Array<String> | Object | Function} urlFragment - 接口片段
             *                 - {String} type - http method
             *                 - {Object | String} data - http request data
             *                 - {Function} success - http response success callback
             *                 - {Object} cache 'homesource 1m|h|d' 缓存关键字缓存时间
             * @returns {} 
             */
            request: function (requestData) {
                var _this = this;

                var ajaxRequest = null;

                setTimeout(function () {

                    var data = getRequestData.call(_this, requestData);
                    var url = getUrl.call(_this, requestData.urlFragment);

                    var httpRequest = function (setCacheData) {
                        ajaxRequest = $.ajax({
                            type: requestData.type,
                            url: url,
                            contentType: _this._contentType,
                            data: data,
                            success: function (response) {
                                // 等待结束
                                loading(false);
                                requestData.error = requestData.error;

                                var result = resultFilter(requestData, response);
                                if (result) {
                                    setCacheData && setCacheData(result);
                                }
                            },
                            error: function (e) {
                                warn(e);
                            }
                        });
                    }

                    // 等待
                    loading(true);

                    // 检查缓存
                    var cacheFormat = requestData.cache;
                    var cacheUrl = cacheFormat && window.localStorage && ("[cache] url(param)".replace("cache", cacheFormat).replace("url", url).replace("param", data ? JSON.stringify(data) : ""));
                    if (cacheUrl) {
                        localStorageByCacheTime(cacheUrl, cacheFormat, function (data) {

                            // 请求数据（函数：没有缓存或缓存无效，去请求数据并告诉怎么更新缓存。  缓存数据：响应缓存）
                            if (typeof (data) == "function") {
                                httpRequest(data);
                            } else {
                                loading(false);
                                resultResponse(requestData, data);
                            }
                        });
                    } else {
                        httpRequest();
                    }
                });

                requestData.thenFn = fnOutputs(requestData, ajaxRequest);

                return requestData.thenFn;
            },


            /**
             * 路由地址设置
             * @returns {} 
             */
            routerUrls: function (urls) {
                if (!urls) {
                    return this._routerUrls || {};
                }

                this._routerUrls = urls;
                return this;
            },

            /**
             * 页面跳转
             * @param {} routerUrl 路由地址
             * @param {} params 参数
             * @returns {} 
             */
            go: function (routerUrl, params) {
                routerUrl = this.routerUrls()[routerUrl] || routerUrl;
                location.href = replaceRouterUrl(routerUrl, params);
            },
            

            path: function (path, params) {
                if (!path) {
                    return this._path;
                }
                this._path = replaceRouterUrl(path, params);
                return this;
            },

            headers: function (headers) {
                this._headers = headers;
                return this;
            },

            contentType: function (contentType) {
                this._contentType = contentType;
                return this;
            },

            /**
             * 一个或一组验证函数
             * @param {} validMode 
             * @returns {} 
             */
            valid: function(validMode) {
                var format = typeFormat(validMode);

                if (format.method) {
                    return validMode();
                }

                if (format.object) {
                    var isValid = true;
                    for (var validName in validMode) {
                        if (validMode.hasOwnProperty(validName)) {
                            if (isValid) {
                                isValid = validMode[validName]();
                            } else {
                                continue;
                            }
                        }
                    }
                    return isValid;
                }

                return true;
            }

        };

        return ModuleApi;

    })();

    // 插件扩展快捷入口
    (function() {
        if ($ && $.ModuleApi == undefined) {
            $.ModuleApi = function (path, params) {
                if ($._ModuleApi == undefined) {
                    $._ModuleApi = new _ModuleApi();
                }
                $._ModuleApi.path(path, params);
                return $._ModuleApi;
            };
            $.ModuleApi.module = function (moduleName) {
                return $.ModuleApi().module(moduleName);
            };
        }
    })();

    return _ModuleApi;

}));