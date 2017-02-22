/*
 * Copyright 2007-2013 Charles du Jeu - Abstrium SAS <team (at) pyd.io>
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
 * The latest code can be found at <https://pydio.com>.
 */

(function(global){

    const Viewer = React.createClass({

        propTypes: {
            node: React.PropTypes.instanceOf(AjxpNode),
            pydio:React.PropTypes.instanceOf(Pydio)
        },

        computeUrl: function(node){

            let url;
            let base = DOMUtils.getUrlFromBase();
            if(base){
                url = base;
                if(!url.startsWith('http') && !url.startsWith('https')){
                    if (!window.location.origin) {
                        // Fix for IE when Pydio is inside an iFrame
                        window.location.origin = window.location.protocol + "//" + window.location.hostname + (window.location.port ? ':' + window.location.port: '');
                    }
                    url = document.location.origin + url;
                }
            }else{
                // Get the URL for current workspace path.
                url = document.location.href.split('#').shift().split('?').shift();
                if(url[(url.length-1)] == '/'){
                    url = url.substr(0, url.length-1);
                }else if(url.lastIndexOf('/') > -1){
                    url = url.substr(0, url.lastIndexOf('/'));
                }
            }

            // Get the direct PDF file link valid for this session.
            const pdfurl = encodeURIComponent(LangUtils.trimRight(url, '\/')
                + '/' + this.props.pydio.Parameters.get('ajxpServerAccess')
                + '&action=get_content&file=base64encoded:' + HasherUtils.base64_encode(node.getPath())
                + '&fake_file_name=' + encodeURIComponent(PathUtils.getBasename(node.getPath())));

            return 'plugins/editor.pdfjs/pdfjs/web/viewer.html?file=' + pdfurl;

        },

        render: function(){

            let src = this.computeUrl(this.props.node);
            return (<iframe src={src} style={Object.assign({border:0}, this.props.style || {})} className="vertical_fit"></iframe>);

        }

    });

    const PydioPDFJSViewer = React.createClass({

        statics:{

            getPreviewComponent: function(node, rich = true){
                if(global.pydio.getPluginConfigs('editor.pdfjs').get('PDFJS_USE_PREVIEW')){
                    return <Viewer style={{width:'100%', height:250}} node={node} pydio={global.pydio}/>;
                }else{
                    return null;
                }
            }

        },

        render(){

            return (
                <PydioComponents.AbstractEditor {...this.props}>
                    <Viewer {...this.props}/>
                </PydioComponents.AbstractEditor>
            );

        }

    });

    global.PydioPDFJSViewer = PydioPDFJSViewer;

})(window);