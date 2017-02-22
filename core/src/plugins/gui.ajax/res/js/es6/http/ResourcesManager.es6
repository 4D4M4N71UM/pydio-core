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

/**
 * A manager that can handle the loading of JS, CSS and checks dependencies
 */
class ResourcesManager{
	/**
	 * Constructor
	 */
	constructor(){
		this.mainFormContainerId = 'all_forms';
		this.resources = {};
		this.loaded = false;
	}	
	/**
	 * Adds a Javascript resource
	 * @param fileName String
	 * @param className String
	 */
	addJSResource(fileName, className){
		if(!this.resources.js){
			this.resources.js = [];
		}
		this.resources.js.push({
            fileName:fileName,
            className:className,
            autoload:false
        });
	}
	/**
	 * Adds a CSS resource
	 * @param fileName String
	 */
	addCSSResource(fileName){
		if(!this.resources.css){
			this.resources.css = [];
		}
		this.resources.css.push(fileName);
	}
	/**
	 * Adds a FORM from html snipper
	 * @param formId String
	 * @param htmlSnippet String
	 */
	addGuiForm(formId, htmlSnippet){
		if(!this.resources.forms){
			this.resources.forms = new Map();
		}
		this.resources.forms.set(formId,htmlSnippet);
	}
	/**
	 * Add a dependency to another plugin
	 * @param data Object
	 */
	addDependency(data){
		if(!this.resources.dependencies){
			this.resources.dependencies = [];
		}
		this.resources.dependencies.push(data);
	}
	/**
	 * Check if some dependencies must be loaded before
	 * @returns Boolean
	 */
	hasDependencies(){
		return (this.resources.dependencies || false);
	}
	/**
	 * Load resources
	 * @param resourcesRegistry Pydio resources registry
	 */
	load(resourcesRegistry, jsAutoloadOnly=false, callback = FuncUtils.Empty){
		if(this.loaded) {
            callback();
            return;
        }
		if(this.hasDependencies() && !this.dependenciesLoaded){
			this.resources.dependencies.forEach(function(el){
				if(resourcesRegistry[el]){
                    // Load dependencies and try again
					resourcesRegistry[el].load(resourcesRegistry, false, function(){
                        this.dependenciesLoaded = true;
                        this.load(resourcesRegistry, false, callback);
                    }.bind(this));
				}
			}.bind(this) );
		}
		if(this.resources.forms){
			this.resources.forms.forEach(function(value,key){
                // REMOVED
				//this.loadGuiForm(key, value);
			}.bind(this) );
		}
        if(this.resources.js){
            let it = this.resources.js.values();
            let cb = function(){
                let object = it.next();
                if(object.value){
                    if(jsAutoloadOnly && !object.value.autoload) {
                        cb();
                        return;
                    }
                    this.loadJSResource(object.value.fileName, object.value.className, cb, true);
                }else{
                    this.loaded = true;
                    callback();
                }
            }.bind(this);
            cb();
        }else{
            this.loaded = true;
            callback();
        }
		if(this.resources.css){
			this.resources.css.forEach(function(value){
				this.loadCSSResource(value);
			}.bind(this));
		}
	}
	/**
	 * Load a javascript file
	 * @param fileName String
	 * @param className String
     * @param callback Function
     * @param aSync Boolean
	 */
	loadJSResource(fileName, className, callback, aSync){

		if(!window[className]){
			if(typeof(className)!='function' || typeof(className.prototype)!='object'){
                var registry = ResourcesManager.__asyncCallbacks;
                if(aSync && registry && registry.get(fileName) && registry.get(fileName)){
                    // Already loading, just register a callback and return
                    this.wrapCallback(callback?callback:function(){}, fileName);
                    return;
                }
                PydioApi.loadLibrary(fileName, (aSync && callback)?this.wrapCallback(callback, fileName):callback, aSync);
			}
		}else if(callback){
            callback();
        }
	}

    wrapCallback(callback, fileName){
        if(!ResourcesManager.__asyncCallbacks) ResourcesManager.__asyncCallbacks = new Map();
        var registry = ResourcesManager.__asyncCallbacks;
        if(!registry.get(fileName)) registry.set(fileName, []);
        registry.get(fileName).push(callback);
        return function(){
            while(registry.get(fileName).length){
                var cb = registry.get(fileName).pop();
                cb();
            }
        };

    }

    loadWebComponents(fileNames, callback){
        if(!Polymer){
            throw Error('Cannot find Polymer library!');
        }
        Polymer.import(fileNames, callback);
    }

	/**
	 * Load a CSS file
	 * @param fileName String
	 */
	loadCSSResource(fileName){

        if(pydio.Parameters.get('SERVER_PREFIX_URI')){
            fileName = pydio.Parameters.get('SERVER_PREFIX_URI')+fileName;
        }
        fileName = fileName+"?v="+pydio.Parameters.get("ajxpVersion");

        let found = false;
        const links = document.getElementsByTagName('link');
        for(let i=0; i<links.length; i++){
            let link = links[i];
            if(link.href === fileName){
                found = true; break;
            }
        }
        if(!found){
            let head = document.getElementsByTagName('head')[0];
            let cssNode = document.createElement('link');
            cssNode.type = 'text/css';
            cssNode.rel  = 'stylesheet';
            cssNode.href = fileName;
            cssNode.media = 'screen';
            head.appendChild(cssNode);
        }

	}
	/**
	 * Load the resources from XML
	 * @param node XMLNode
	 */
	loadFromXmlNode(node){
        var clForm = {};
        var k;
		if(node.nodeName == "resources"){
			for(k=0;k<node.childNodes.length;k++){
				if(node.childNodes[k].nodeName == 'js'){
					this.addJSResource(
                        ResourcesManager.getFileOrFallback(node.childNodes[k]),
                        node.childNodes[k].getAttribute('className'),
                        (node.childNodes[k].getAttribute('autoload') === true)
                    );
				}else if(node.childNodes[k].nodeName == 'css'){
					this.addCSSResource(ResourcesManager.getFileOrFallback(node.childNodes[k]));
				}else if(node.childNodes[k].nodeName == 'img_library'){
					ResourcesManager.addImageLibrary(node.childNodes[k].getAttribute('alias'), node.childNodes[k].getAttribute('path'));
				}
			}		
		}else if(node.nodeName == "dependencies"){
			for(k=0;k<node.childNodes.length;k++){
				if(node.childNodes[k].nodeName == "pluginResources"){
					this.addDependency(node.childNodes[k].getAttribute("pluginName"));
				}
			}
		}else if(node.nodeName == "clientForm"){
            if(!node.getAttribute("theme") || node.getAttribute("theme") == pydio.Parameters.get("theme")){
                clForm = {formId:node.getAttribute("id"), formCode:node.firstChild.nodeValue};
            }
		}
        if(clForm.formId){
            this.addGuiForm(clForm.formId, clForm.formCode);
        }
	}

    /**
     *
     * @param aliasName
     * @param aliasPath
     * @todo MOVE OUTSIDE?
     */
    static addImageLibrary(aliasName, aliasPath){
        if(!window.AjxpImageLibraries) window.AjxpImageLibraries = {};
        window.AjxpImageLibraries[aliasName] = aliasPath;
    }

    /**
     * Find the default images path
     * @param src Icon source
     * @param defaultPath Default path, can contain ICON_SIZE
     * @param size Integer size optional
     * @returns string
     */
    static resolveImageSource(src, defaultPath, size){
        if(!src) return "";
        let imagesFolder = ajxpResourcesFolder + '/images';
        if(pydioBootstrap.parameters.get('ajxpImagesCommon')){
            imagesFolder = imagesFolder.replace('/'+pydioBootstrap.parameters.get('theme')+'/', '/common/');
        }

        if(defaultPath && defaultPath[0] !== '/') {
            defaultPath = '/' + defaultPath;
        }

        if(!window.AjxpImageLibraries || src.indexOf("/")==-1){
            return imagesFolder + (defaultPath?(size?defaultPath.replace("ICON_SIZE", size):defaultPath):'')+ '/' +  src;
        }
        var radic = src.substring(0,src.indexOf("/"));
        if(window.AjxpImageLibraries[radic]){
            src = src.replace(radic, window.AjxpImageLibraries[radic]);
            if(pydioBootstrap.parameters.get("SERVER_PREFIX_URI")){
                src = pydioBootstrap.parameters.get("SERVER_PREFIX_URI") + src;
            }
            return (size?src.replace("ICON_SIZE", size):src);
        }else{
            return imagesFolder + (defaultPath?(size?defaultPath.replace("ICON_SIZE", size):defaultPath):'')+ '/' +  src;
        }
    }

    /**
	 * Check if resources are tagged autoload and load them
	 * @param registry DOMDocument XML Registry
	 */
	static loadAutoLoadResources(registry){
        var manager = new ResourcesManager();
		var jsNodes = XMLUtils.XPathSelectNodes(registry, 'plugins/*/client_settings/resources/js');
        var node;
        ResourcesManager.__modules = new Map();
        ResourcesManager.__dependencies = new Map();
        ResourcesManager.__components = new Map();
        for(node of jsNodes){
            ResourcesManager.__modules.set(node.getAttribute('className'), ResourcesManager.getFileOrFallback(node));
            if(node.getAttribute('autoload') === "true"){
                manager.loadJSResource(ResourcesManager.getFileOrFallback(node), node.getAttribute('className'), null, false);
            }
            if(node.getAttribute('depends')){
                ResourcesManager.__dependencies.set(node.getAttribute('className'), node.getAttribute('depends').split(','));
            }
        }
        var compNodes = XMLUtils.XPathSelectNodes(registry, 'plugins/*/client_settings/resources/component');
        for(node of compNodes){
            ResourcesManager.__components.set(node.getAttribute('componentName'), ResourcesManager.getFileOrFallback(node));
            if(node.getAttribute('autoload') === "true"){
                manager.loadWebComponents([ResourcesManager.getFileOrFallback(node)]);
            }
        }
		var imgNodes = XMLUtils.XPathSelectNodes(registry, 'plugins/*/client_settings/resources/img_library');
        for(node of imgNodes){
            ResourcesManager.addImageLibrary(node.getAttribute('alias'), node.getAttribute('path'));
        }
		var cssNodes = XMLUtils.XPathSelectNodes(registry, 'plugins/*/client_settings/resources/css[@autoload="true"]');
        for(node of cssNodes){
			manager.loadCSSResource(ResourcesManager.getFileOrFallback(node));
        }
	}

    static getFileOrFallback(node){
        if(node.getAttribute('fallbackCondition') && eval(node.getAttribute('fallbackCondition'))){
            return node.getAttribute('fallbackFile');
        }else{
            return node.getAttribute('file');
        }
    }

    /**
     *
     * @param className String
     * @param dependencies Set
     */
    static findDependencies(className, dependencies){
        if(ResourcesManager.__dependencies.has(className)){
            var deps = ResourcesManager.__dependencies.get(className);
            deps.forEach(function(dep){
                if(!dependencies.has(dep) && ResourcesManager.__modules.has(dep)){
                    dependencies.add(dep);
                    ResourcesManager.findDependencies(dep, dependencies);
                }
            });
        }
    }

    static loadClassesAndApply(classNames, callbackFunc){
        if(!ResourcesManager.__modules){
            ResourcesManager.loadAutoLoadResources(pydio.Registry.getXML());
        }
        var modules = new Map();
        classNames.forEach(function(c){
            if(!window[c] && ResourcesManager.__modules.has(c)){
                var deps = new Set();
                ResourcesManager.findDependencies(c, deps);
                if(deps.size){
                    deps.forEach(function(d){
                        modules.set(d, {
                            className:d,
                            fileName:ResourcesManager.__modules.get(d),
                            require:ResourcesManager.__modules.get(d).replace('.js', '')
                        });
                    });
                }
                modules.set(c, {
                    className:c,
                    fileName:ResourcesManager.__modules.get(c),
                    require:ResourcesManager.__modules.get(c).replace('.js', '')
                });
            }
        });
        if(!modules.size){
            callbackFunc();
            return;
        }

        if(modules.size == 1){
            ResourcesManager.detectModuleToLoadAndApply(modules.keys().next().value, callbackFunc);
            return;
        }
        if(window.requirejs){
            // Let require handle multiple async
            var requires = [];
            modules.forEach(function(e){requires.push(e.require);});
            requirejs(requires, callbackFunc);
        }else{
            // Load sync and apply the callback manually
            var loader = new ResourcesManager();
            let it = modules.values();
            let cb = function(){
                let object = it.next();
                if(object.value){
                    loader.loadJSResource(object.value.fileName, object.value.className, cb, true);
                }else{
                    callbackFunc();
                }
            };
            cb();
        }
    }

    static detectModuleToLoadAndApply(callbackString, callbackFunc, async = true){
        if(!ResourcesManager.__modules){
            ResourcesManager.loadAutoLoadResources(pydio.Registry.getXML());
        }
        var className = callbackString.split('.',1).shift();
        if(!window[className] && ResourcesManager.__modules.has(className)){
            if(!async){
                let loader = new ResourcesManager();
                loader.loadJSResource(ResourcesManager.__modules.get(className), className, null, false);
                return callbackFunc();
            }
            if(window.requirejs){
                requirejs([ResourcesManager.__modules.get(className).replace('.js','')], callbackFunc);
            }else{
                let loader = new ResourcesManager();
                loader.loadJSResource(ResourcesManager.__modules.get(className), className, callbackFunc, true);
            }
        }else{
            return callbackFunc();
        }
    }

    static loadWebComponentsAndApply(componentsList, callbackFunc){
        if(!ResourcesManager.__modules){
            ResourcesManager.loadAutoLoadResources(pydio.Registry.getXML());
        }
        var files = [];
        componentsList.forEach(function(v){
            if(ResourcesManager.__components.has(v)) {
                files.push(ResourcesManager.__components.get(v));
            }
        });
        if(files.length){
            var manager = new ResourcesManager();
            manager.loadWebComponents(files, callbackFunc);
        }
    }
}