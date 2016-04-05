/*
 * Copyright 2007-2012 Charles du Jeu <contact (at) cdujeu.me>
 * This file is part of Pydio.
 *
 * Pydio is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Pydio is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Pydio.  If not, see <http://www.gnu.org/licenses/>.
 *
 * The latest code can be found at <http://pyd.io/>.
 */

/**
 * Use WebSocket or Poller
 */
Class.create("AjxpMqObserver", {

    pe:null,
    currentRepo:null,
    clientId:null,
    ws: null,
    configs: null,
    channel_pending: false,

    initialize : function(){
        "use strict";

        if(window.ajxpMinisite) return;

        this.clientId = window.ajxpBootstrap.parameters.get("SECURE_TOKEN");
        this.configs = ajaxplorer.getPluginConfigs("mq");

        document.observe("ajaxplorer:repository_list_refreshed", function(event){

            var repoId;
            var data = event.memo;
            if(data.active) {
                repoId = data.active;
            } else if(pydio.repositoryId) {
                repoId = pydio.repositoryId;
            }
            if(this.currentRepo && this.currentRepo == repoId){ // Ignore, repoId did not change!
                return;
            }
            this.initForRepoId(repoId);

        }.bind(this));

        if(ajaxplorer.repositoryId){
            this.initForRepoId(ajaxplorer.repositoryId);
        }

    },

    initForRepoId:function(repoId){
        if (this.configs.get("WS_SERVER_ACTIVE")){

            if(this.ws) {
                if(!repoId){
                    this.ws.on('close', function(){
                        delete this.ws;
                    }.bind(this));

                    this.ws.close();
                } else {
                    try{
                        this.ws.emit("register", { my: repoId });
                    }catch(e){
                        if(console) console.log('Error while sending WebSocket message: '+ e.message);
                    }
                }
            }else{
                if(repoId){

                    var url = "http"+(this.configs.get("WS_SERVER_SECURE")?"s":"")
                        + "://"+this.configs.get("WS_SERVER_HOST")
                        + ":"+this.configs.get("WS_SERVER_PORT")
                        + this.configs.get("WS_SERVER_PATH");

                    this.ws = io(url + '?token=' + Connexion.SECURE_TOKEN, {
                        reconnection: false,
                        transports:['websocket']
                    });

                    this.ws.on('message', function(message){
                        var xmlContent = new DOMParser().parseFromString(message, "text/xml");
                        PydioApi.getClient().parseXmlMessage(xmlContent);
                        ajaxplorer.notify("server_message", xmlContent);
                    }.bind(this));

                    this.ws.on('connect', function () {
                        this.ws.emit("register", { my: repoId });
                    }.bind(this));

                    this.ws.on('close', function(event){
                        var reason;

                        // See http://tools.ietf.org/html/rfc6455#section-7.4.1
                        if (event.code == 1000)
                            reason = "Normal closure, meaning that the purpose for which the connection was established has been fulfilled.";
                        else if(event.code == 1001)
                            reason = "An endpoint is \"going away\", such as a server going down or a browser having navigated away from a page.";
                        else if(event.code == 1002)
                            reason = "An endpoint is terminating the connection due to a protocol error";
                        else if(event.code == 1003)
                            reason = "An endpoint is terminating the connection because it has received a type of data it cannot accept (e.g., an endpoint that understands only text data MAY send this if it receives a binary message).";
                        else if(event.code == 1004)
                            reason = "Reserved. The specific meaning might be defined in the future.";
                        else if(event.code == 1005)
                            reason = "No status code was actually present.";
                        else if(event.code == 1006)
                            reason = "The connection was closed abnormally, e.g., without sending or receiving a Close control frame";
                        else if(event.code == 1007)
                            reason = "An endpoint is terminating the connection because it has received data within a message that was not consistent with the type of the message (e.g., non-UTF-8 [http://tools.ietf.org/html/rfc3629] data within a text message).";
                        else if(event.code == 1008)
                            reason = "An endpoint is terminating the connection because it has received a message that \"violates its policy\". This reason is given either if there is no other sutible reason, or if there is a need to hide specific details about the policy.";
                        else if(event.code == 1009)
                            reason = "An endpoint is terminating the connection because it has received a message that is too big for it to process.";
                        else if(event.code == 1010) // Note that this status code is not used by the server, because it can fail the WebSocket handshake instead.
                            reason = "An endpoint (client) is terminating the connection because it has expected the server to negotiate one or more extension, but the server didn't return them in the response message of the WebSocket handshake. Specifically, the extensions that are needed are: " + event.reason;
                        else if(event.code == 1011)
                            reason = "A server is terminating the connection because it encountered an unexpected condition that prevented it from fulfilling the request.";
                        else if(event.code == 1015)
                            reason = "The connection was closed due to a failure to perform a TLS handshake (e.g., the server certificate can't be verified).";
                        else
                            reason = "Unknown reason";

                        if(window.console){
                            console.error("WebSocket Closed Connection for this reason :" + reason + " (code "+event.code+")");
                            console.error("Switching back to polling");
                        }

                        delete this.ws;

                        this.configs.set("WS_SERVER_ACTIVE", false);
                        this.initForRepoId(repoId);
                    }.bind(this));

                    function revertToPolling() {
                        if(window.console){
                            console.error("Cannot login to websocket server, switching back to polling");
                        }
                        delete this.ws;
                        this.configs.set("WS_SERVER_ACTIVE", false);
                        this.initForRepoId(repoId);
                    }

                    this.ws.on('connect_error', revertToPolling.bind(this))
                    this.ws.on('disconnect', revertToPolling.bind(this))
                }
            }

        }else{

            if(this.pe){
                this.pe.stop();
            }

            if(this.currentRepo && repoId){

                this.unregisterCurrentChannel(function(){
                    this.registerChannel(repoId);
                }.bind(this));

            }else if(this.currentRepo && !repoId){

                this.unregisterCurrentChannel();

            }else if(!this.currentRepo && repoId){

                this.registerChannel(repoId);

            }

        }

    },

    unregisterCurrentChannel : function(callback){

        var conn = new Connexion();
        conn.setParameters($H({
            get_action:'client_unregister_channel',
            channel:'nodes:' + this.currentRepo,
            client_id:this.clientId
        }));
        conn.discrete = true;
        conn.onComplete = function(transp){
            this.currentRepo = null;
            if(callback) callback();
        }.bind(this);
        conn.sendAsync();

    },

    registerChannel : function(repoId){

        this.currentRepo = repoId;
        var conn = new Connexion();
        conn.setParameters($H({
            get_action:'client_register_channel',
            channel:'nodes:' + repoId,
            client_id:this.clientId
        }));
        conn.discrete = true;
        conn.sendAsync();

        this.pe = new PeriodicalExecuter(this.consumeChannel.bind(this), this.configs.get('POLLER_FREQUENCY') || 5);

    },

    consumeChannel : function(){
        if(this.channel_pending) {
            return;
        }
        var conn = new Connexion();
        conn.setParameters($H({
            get_action:'client_consume_channel',
            channel:'nodes:' + this.currentRepo,
            client_id:this.clientId
        }));
        conn.discrete = true;
        conn.onComplete = function(transport){
            this.channel_pending = false;
            if(transport.responseXML){
                PydioApi.getClient().parseXmlMessage(transport.responseXML);
                ajaxplorer.notify("server_message", transport.responseXML);
            }
        }.bind(this);
        this.channel_pending = true;
        conn.sendAsync();
    }

});