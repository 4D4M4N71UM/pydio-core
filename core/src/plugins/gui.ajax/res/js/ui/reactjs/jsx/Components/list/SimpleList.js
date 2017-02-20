import MessagesConsumerMixin from '../MessagesConsumerMixin'
import {ListEntry} from './ListEntry'
import TableListEntry from './TableListEntry'
import TableListHeader from './TableListHeader'
import ConfigurableListEntry from './ConfigurableListEntry'
import SortColumns from './SortColumns'
import ListPaginator from './ListPaginator'
import SimpleReactActionBar from '../SimpleReactActionBar'
import ContextMenuNodeProviderMixin from '../menu/ContextMenuNodeProviderMixin'

/**
 * Main List component
 */
let SimpleList = React.createClass({

    mixins:[MessagesConsumerMixin, ContextMenuNodeProviderMixin],

    propTypes:{
        infiniteSliceCount:React.PropTypes.number,
        filterNodes:React.PropTypes.func,
        customToolbar:React.PropTypes.object,
        tableKeys:React.PropTypes.object,
        autoRefresh:React.PropTypes.number,
        reloadAtCursor:React.PropTypes.bool,
        heightAutoWithMax:React.PropTypes.number,
        observeNodeReload:React.PropTypes.bool,
        groupByFields:React.PropTypes.array,
        defaultGroupBy:React.PropTypes.string,

        skipParentNavigation: React.PropTypes.bool,
        skipInternalDataModel:React.PropTypes.bool,

        entryEnableSelector:React.PropTypes.func,
        entryRenderIcon:React.PropTypes.func,
        entryRenderActions:React.PropTypes.func,
        entryRenderFirstLine:React.PropTypes.func,
        entryRenderSecondLine:React.PropTypes.func,
        entryRenderThirdLine:React.PropTypes.func,
        entryHandleClicks:React.PropTypes.func,

        openEditor:React.PropTypes.func,
        openCollection:React.PropTypes.func,

        elementStyle: React.PropTypes.object,
        passScrollingStateToChildren:React.PropTypes.bool,
        elementHeight:React.PropTypes.oneOfType([
            React.PropTypes.number,
            React.PropTypes.object
        ]).isRequired

    },

    statics:{
        HEIGHT_ONE_LINE:50,
        HEIGHT_TWO_LINES:73,
        CLICK_TYPE_SIMPLE:'simple',
        CLICK_TYPE_DOUBLE:'double'
    },

    getDefaultProps:function(){
        return {infiniteSliceCount:30}
    },

    clickRow: function(gridRow){
        var node;
        if(gridRow.props){
            node = gridRow.props.data.node;
        }else{
            node = gridRow;
        }
        if(this.props.entryHandleClicks){
            this.props.entryHandleClicks(node, SimpleList.CLICK_TYPE_SIMPLE);
            return;
        }
        if(node.isLeaf() && this.props.openEditor) {
            var res = this.props.openEditor(node);
            if( res === false){
                return;
            }
            var uniqueSelection = new Map();
            uniqueSelection.set(node, true);
            this.setState({selection:uniqueSelection}, this.rebuildLoadedElements);
        } else if(!node.isLeaf()) {
            if(this.props.openCollection){
                this.props.openCollection(node);
            }else{
                this.props.dataModel.setSelectedNodes([node]);
            }
        }
    },

    doubleClickRow: function(gridRow){
        var node;
        if(gridRow.props){
            node = gridRow.props.data.node;
        }else{
            node = gridRow;
        }
        if(this.props.entryHandleClicks){
            this.props.entryHandleClicks(node, SimpleList.CLICK_TYPE_DOUBLE);
        }
    },

    onColumnSort: function(column){

        let pagination = this.props.node.getMetadata().get('paginationData');
        if(pagination && pagination.get('total') > 1 && pagination.get('remote_order')){

            let dir = 'asc';
            if(this.props.node.getMetadata().get('paginationData').get('currentOrderDir')){
                dir = this.props.node.getMetadata().get('paginationData').get('currentOrderDir') === 'asc' ? 'desc' : 'asc';
            }
            let orderData = new Map();
            orderData.set('order_column', column['remoteSortAttribute']?column.remoteSortAttribute:column.name);
            orderData.set('order_direction', dir);
            this.props.node.getMetadata().set("remote_order", orderData);
            this.props.dataModel.requireContextChange(this.props.node, true);

        }else{

            let att = column['sortAttribute']?column['sortAttribute']:column.name;
            let dir = 'asc';
            if(this.state && this.state.sortingInfo && this.state.sortingInfo.attribute === att){
                dir = this.state.sortingInfo.direction === 'asc' ? 'desc' : 'asc';
            }
            this.setState({sortingInfo:{
                attribute : att,
                sortType  : column.sortType,
                direction : dir
            }}, function(){
                this.rebuildLoadedElements();
            }.bind(this));

        }

    },

    onKeyDown: function(e){
        let currentIndexStart, currentIndexEnd;
        let contextHolder = window.pydio.getContextHolder();
        const elementsPerLine = this.props.elementsPerLine || 1;
        const shiftKey = e.shiftKey;
        const key = e.key;

        if(contextHolder.isEmpty() || !this.indexedElements ) {
            return;
        }
        let downKeys = ['ArrowDown', 'ArrowRight', 'PageDown', 'End'];

        let position = (shiftKey && downKeys.indexOf(key) > -1) ? 'first' : 'last';
        let currentSelection = contextHolder.getSelectedNodes();

        let firstSelected = currentSelection[0];
        let lastSelected = currentSelection[currentSelection.length - 1];

        if(key === 'Enter'){
            this.doubleClickRow(firstSelected);
            return;
        }

        for(let i=0; i< this.indexedElements.length; i++){
            if(this.indexedElements[i].node === firstSelected) {
                currentIndexStart = i;
            }
            if(this.indexedElements[i].node === lastSelected) {
                currentIndexEnd = i;
                break;
            }
        }
        let selectionIndex;
        let maxIndex = this.indexedElements.length - 1;
        let increment = (key === 'PageDown' || key === 'PageUp' ? 10 : 1);
        if(key === 'ArrowDown' || key === 'PageDown'){
            selectionIndex = Math.min(currentIndexEnd + elementsPerLine * increment, maxIndex);
        }else if(key === 'ArrowUp' || key === 'PageUp'){
            selectionIndex = Math.max(currentIndexStart - elementsPerLine * increment, 0);
        }else if(key === 'Home'){
            selectionIndex = 0;
        }else if(key === 'End'){
            selectionIndex = maxIndex;
        }
        if(elementsPerLine > 1){
            if(key === 'ArrowRight'){
                selectionIndex = currentIndexEnd + 1;
            }else if(key === 'ArrowLeft'){
                selectionIndex = currentIndexStart - 1;
            }
        }

        if(shiftKey && selectionIndex !== undefined){
            const min = Math.min(currentIndexStart, currentIndexEnd, selectionIndex);
            const max = Math.max(currentIndexStart, currentIndexEnd, selectionIndex);
            if(min !== max){
                let selection = [];
                for(let i=min; i<max+1; i++){
                    if(this.indexedElements[i]) selection.push(this.indexedElements[i].node);
                }
                contextHolder.setSelectedNodes(selection);
            }
        }else if(this.indexedElements[selectionIndex] && this.indexedElements[selectionIndex].node){
            contextHolder.setSelectedNodes([this.indexedElements[selectionIndex].node]);
        }

    },

    getInitialState: function(){
        this.actionsCache = {multiple:new Map()};
        if(!this.props.skipInternalDataModel){
            this.dm = new PydioDataModel();
            this.dm.setContextNode(this.props.dataModel.getContextNode());
        }else{
            this.dm = this.props.dataModel;
        }
        var state = {
            loaded: this.props.node.isLoaded(),
            loading: !this.props.node.isLoaded(),
            showSelector:false,
            elements: this.props.node.isLoaded()?this.buildElements(0, this.props.infiniteSliceCount):[],
            containerHeight:this.props.heightAutoWithMax?0:500,
            filterNodes:this.props.filterNodes
        };
        if(this.props.defaultGroupBy){
            state.groupBy = this.props.defaultGroupBy;
        }
        if(this.props.elementHeight instanceof Object){
            state.elementHeight = this.computeElementHeightResponsive();
        }
        state.infiniteLoadBeginBottomOffset = 200;
        return state;
    },

    componentWillReceiveProps: function(nextProps) {
        this.indexedElements = null;
        var currentLength = Math.max(this.state.elements.length, nextProps.infiniteSliceCount);
        this.setState({
            loaded: nextProps.node.isLoaded(),
            loading:!nextProps.node.isLoaded(),
            showSelector:false,
            elements:nextProps.node.isLoaded()?this.buildElements(0, currentLength, nextProps.node):[],
            infiniteLoadBeginBottomOffset:200,
            filterNodes:nextProps.filterNodes ? nextProps.filterNodes : this.props.filterNodes
        });
        if(!nextProps.autoRefresh&& this.refreshInterval){
            window.clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }else if(nextProps.autoRefresh && !this.refreshInterval){
            this.refreshInterval = window.setInterval(this.reload, nextProps.autoRefresh);
        }
        this.patchInfiniteGrid(nextProps.elementsPerLine);
        if(this.props.node && nextProps.node !== this.props.node) {
            this.observeNodeChildren(this.props.node, true);
        }
    },

    observeNodeChildren: function(node, stop = false){
        if(stop && !this._childrenObserver) return;

        if(!this._childrenObserver){
            this._childrenObserver = function(){
                this.indexedElements = null;
                this.rebuildLoadedElements();
            }.bind(this);
        }
        if(!this._childrenActionsObserver){
            this._childrenActionsObserver = function(eventMemo){
                if(eventMemo.type === 'prompt-rename'){
                    this.setState({inlineEditionForNode:eventMemo.child, inlineEditionCallback:eventMemo.callback});
                }
            }.bind(this);
        }
        if(stop){
            node.stopObserving("child_added", this._childrenObserver);
            node.stopObserving("child_removed", this._childrenObserver);
            node.stopObserving("child_node_action", this._childrenActionsObserver);
        }else{
            node.observe("child_added", this._childrenObserver);
            node.observe("child_removed", this._childrenObserver);
            node.observe("child_node_action", this._childrenActionsObserver);
        }
    },

    _loadNodeIfNotLoaded: function(){
        var node = this.props.node;
        if(!node.isLoaded()){
            node.observeOnce("loaded", function(){
                if(!this.isMounted()) return;
                if(this.props.node === node){
                    this.observeNodeChildren(node);
                    this.setState({
                        loaded:true,
                        loading: false,
                        elements:this.buildElements(0, this.props.infiniteSliceCount)
                    });
                }
                if(this.props.heightAutoWithMax){
                    this.updateInfiniteContainerHeight();
                }
            }.bind(this));
            node.load();
        }else{
            this.observeNodeChildren(node);
        }
    },

    _loadingListener: function(){
        this.observeNodeChildren(this.props.node, true);
        this.setState({loaded:false, loading:true});
        this.indexedElements = null;
    },
    _loadedListener: function(){
        var currentLength = Math.max(this.state.elements.length, this.props.infiniteSliceCount);
        this.setState({
            loading:false,
            elements:this.buildElements(0, currentLength, this.props.node)
        });
        if(this.props.heightAutoWithMax){
            this.updateInfiniteContainerHeight();
        }
        this.observeNodeChildren(this.props.node);
    },

    reload: function(){
        if(this.props.reloadAtCursor && this._currentCursor){
            this.loadStartingAtCursor();
            return;
        }
        this._loadingListener();
        this.props.node.observeOnce("loaded", this._loadedListener);
        this.props.node.reload();
    },

    loadStartingAtCursor: function(){
        this._loadingListener();
        var node = this.props.node;
        var cachedChildren = node.getChildren();
        var newChildren = [];
        node.observeOnce("loaded", function(){
            var reorderedChildren = new Map();
            newChildren.map(function(c){reorderedChildren.set(c.getPath(), c);});
            cachedChildren.forEach(function(c){reorderedChildren.set(c.getPath(), c);});
            node._children = reorderedChildren;
            this._loadedListener();
        }.bind(this));
        node.setLoaded(false);
        node.observe("child_added", function(newChild){
            newChildren.push(node._children.get(newChild));
        });
        this.props.node.load(null, {cursor:this._currentCursor});
    },

    wireReloadListeners: function(){
        this.wrappedLoading = this._loadingListener;
        this.wrappedLoaded = this._loadedListener;
        this.props.node.observe("loading", this.wrappedLoading);
        this.props.node.observe("loaded", this.wrappedLoaded);
    },
    stopReloadListeners:function(){
        this.props.node.stopObserving("loading", this.wrappedLoading);
        this.props.node.stopObserving("loaded", this.wrappedLoaded);
    },

    toggleSelector:function(){
        // Force rebuild elements
        this.setState({
            showSelector:!this.state.showSelector,
            selection:new Map()
        }, this.rebuildLoadedElements);
    },

    toggleSelection:function(node){
        var selection = this.state.selection || new Map();
        if(selection.get(node)) selection.delete(node);
        else selection.set(node, true);
        this.refs.all_selector.setChecked(false);
        this.setState({
            selection:selection
        }, this.rebuildLoadedElements);
    },

    selectAll:function(){
        if(!this.refs.all_selector.isChecked()){
            this.setState({selection:new Map()}, this.rebuildLoadedElements);
        }else{
            var selection = new Map();
            this.props.node.getChildren().forEach(function(child){
                if(this.state && this.state.filterNodes && !this.state.filterNodes(child)){
                    return;
                }
                if(child.isLeaf()){
                    selection.set(child, true);
                }
            }.bind(this));
            this.refs.all_selector.setChecked(true);
            this.setState({selection:selection}, this.rebuildLoadedElements);
        }
    },

    applyMultipleAction: function(ev){
        if(!this.state.selection || !this.state.selection.size){
            return;
        }
        var actionName = ev.currentTarget.getAttribute('data-action');
        var dm = this.dm || new PydioDataModel();
        dm.setContextNode(this.props.node);
        var selNodes = [];
        this.state.selection.forEach(function(v, node){
            selNodes.push(node);
        });
        dm.setSelectedNodes(selNodes);
        var a = window.pydio.Controller.getActionByName(actionName);
        a.fireContextChange(dm, true, window.pydio.user);
        //a.fireSelectionChange(dm);
        a.apply([dm]);

        ev.stopPropagation();
        ev.preventDefault();
    },

    getActionsForNode: function(dm, node){
        var cacheKey = node.isLeaf() ? 'file-' + node.getAjxpMime() :'folder';
        var selectionType = node.isLeaf() ? 'file' : 'dir';
        var nodeActions = [];
        if(this.actionsCache[cacheKey]) {
            nodeActions = this.actionsCache[cacheKey];
        }else{
            dm.setSelectedNodes([node]);
            window.pydio.Controller.actions.forEach(function(a){
                a.fireContextChange(dm, true, window.pydio.user);
                if(a.context.selection && a.context.actionBar && a.selectionContext[selectionType] && !a.deny && a.options.icon_class
                    && (!this.props.actionBarGroups || this.props.actionBarGroups.indexOf(a.context.actionBarGroup) !== -1)
                    && (!a.selectionContext.allowedMimes.length || a.selectionContext.allowedMimes.indexOf(node.getAjxpMime()) !== -1)
                ) {
                    nodeActions.push(a);
                    if(node.isLeaf() &&  a.selectionContext.unique === false) {
                        this.actionsCache.multiple.set(a.options.name, a);
                    }
                }
            }.bind(this));
            this.actionsCache[cacheKey] = nodeActions;
        }
        return nodeActions;
    },

    updateInfiniteContainerHeight: function(){
        var containerHeight = this.refs.infiniteParent.clientHeight;
        if(this.props.heightAutoWithMax){
            var elementHeight = this.state.elementHeight?this.state.elementHeight:this.props.elementHeight;
            containerHeight = Math.min(this.props.node.getChildren().size * elementHeight ,this.props.heightAutoWithMax);
        }
        this.setState({containerHeight:containerHeight});
    },

    computeElementHeightResponsive:function(){
        var breaks = this.props.elementHeight;
        if(! (breaks instanceof Object) ){
            breaks = {
                "min-width:480px":this.props.elementHeight,
                "max-width:480px":(Object.keys(this.props.tableKeys).length * 24) + 33
            };
        }
        if(window.matchMedia){
            for(var k in breaks){
                if(breaks.hasOwnProperty(k) && window.matchMedia('('+k+')').matches){
                    return breaks[k];
                }
            }
        }else{
            var width = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
            if(width < 480) return breaks["max-width:480px"];
            else return breaks["max-width:480px"];
        }
        return 50;
    },

    updateElementHeightResponsive: function(){
        var newH = this.computeElementHeightResponsive();
        if(!this.state || !this.state.elementHeight || this.state.elementHeight != newH){
            this.setState({elementHeight:newH}, function(){
                if(this.props.heightAutoWithMax){
                    this.updateInfiniteContainerHeight();
                }
            }.bind(this));
        }
    },

    patchInfiniteGrid: function(els){
        if(this.refs.infinite && els > 1){
            this.refs.infinite.state.infiniteComputer.__proto__.getDisplayIndexStart = function (windowTop){
                return els * Math.floor((windowTop/this.heightData) / els)
            };
            this.refs.infinite.state.infiniteComputer.__proto__.getDisplayIndexEnd = function (windowBottom){
                return els * Math.ceil((windowBottom/this.heightData) / els)
            };
        }
    },

    componentDidMount: function(){
        this._loadNodeIfNotLoaded();
        this.patchInfiniteGrid(this.props.elementsPerLine);
        if(this.refs.infiniteParent){
            this.updateInfiniteContainerHeight();
            if(!this.props.heightAutoWithMax && !this.props.externalResize) {
                if(window.addEventListener){
                    window.addEventListener('resize', this.updateInfiniteContainerHeight);
                }else{
                    window.attachEvent('onresize', this.updateInfiniteContainerHeight);
                }
            }
        }
        if(this.props.autoRefresh){
            this.refreshInterval = window.setInterval(this.reload, this.props.autoRefresh);
        }
        if(this.props.observeNodeReload){
            this.wireReloadListeners();
        }
        if(this.props.elementHeight instanceof Object || this.props.tableKeys){
            if(window.addEventListener){
                window.addEventListener('resize', this.updateElementHeightResponsive);
            }else{
                window.attachEvent('onresize', this.updateElementHeightResponsive);
            }
            this.updateElementHeightResponsive();
        }
        this.props.dataModel.observe('selection_changed', function(){
            if(!this.isMounted()) return;
            let selection = new Map();
            this.props.dataModel.getSelectedNodes().map(function(n){
                selection.set(n, true);
            });
            this.setState({selection: selection}, this.rebuildLoadedElements);
        }.bind(this));
    },

    componentWillUnmount: function(){
        if(!this.props.heightAutoWithMax) {
            if(window.removeEventListener){
                window.removeEventListener('resize', this.updateInfiniteContainerHeight);
            }else{
                window.detachEvent('onresize', this.updateInfiniteContainerHeight);
            }
        }
        if(this.props.elementHeight instanceof Object || this.props.tableKeys){
            if(window.removeEventListener){
                window.removeEventListener('resize', this.updateElementHeightResponsive);
            }else{
                window.detachEvent('resize', this.updateElementHeightResponsive);
            }
        }
        if(this.refreshInterval){
            window.clearInterval(this.refreshInterval);
        }
        if(this.props.observeNodeReload){
            this.stopReloadListeners();
        }
        if(this.props.node) {
            this.observeNodeChildren(this.props.node, true);
        }
    },

    componentDidUpdate: function(prevProps, prevState){
        if(prevProps.node && this.props.node && prevProps.node.getPath() === this.props.node.getPath()){
            return;
        }
        this._loadNodeIfNotLoaded();
    },

    onScroll:function(scrollTop){

        if(!this.props.passScrollingStateToChildren){
            return;
        }
        // Maintains a series of timeouts to set this.state.isScrolling
        // to be true when the element is scrolling.

        if (this.state.scrollTimeout) {
            clearTimeout(this.state.scrollTimeout);
        }

        var that = this,
            scrollTimeout = setTimeout(() => {
                that.setState({
                    isScrolling: false,
                    scrollTimeout: undefined
                })
            }, 150);

        this.setState({
            isScrolling: true,
            scrollTimeout: scrollTimeout
        });

    },

    buildElementsFromNodeEntries: function(nodeEntries, showSelector){

        var components = [];
        nodeEntries.forEach(function(entry){
            var data;
            if(entry.parent) {
                data = {
                    node: entry.node,
                    key: entry.node.getPath(),
                    id: entry.node.getPath(),
                    mainIcon: "mdi mdi-arrow-up",
                    firstLine: "..",
                    className: "list-parent-node",
                    secondLine:this.context.getMessage('react.1'),
                    onClick: this.clickRow,
                    onDoubleClick: this.doubleClickRow,
                    showSelector: false,
                    selectorDisabled: true
                };
                if(this.props.elementStyle){
                    data['style'] = this.props.elementStyle;
                }
                if(this.props.passScrollingStateToChildren){
                    data['parentIsScrolling'] = this.state.isScrolling;
                }
                components.push(React.createElement(ListEntry, data));
            }else if(entry.groupHeader){
                data = {
                    node: null,
                    key: entry.groupHeader,
                    id: entry.groupHeader,
                    mainIcon: null,
                    firstLine: entry.groupHeader,
                    className:'list-group-header',
                    onClick: null,
                    showSelector: false,
                    selectorDisabled: true
                };
                if(this.props.passScrollingStateToChildren){
                    data['parentIsScrolling'] = this.state.isScrolling;
                }
                components.push(React.createElement(ListEntry, data));
            }else{
                data = {
                    node:entry.node,
                    onClick: this.clickRow,
                    onDoubleClick: this.doubleClickRow,
                    onSelect:this.toggleSelection,
                    key:entry.node.getPath(),
                    id:entry.node.getPath(),
                    renderIcon:this.props.entryRenderIcon,
                    renderFirstLine:this.props.entryRenderFirstLine,
                    renderSecondLine:this.props.entryRenderSecondLine,
                    renderThirdLine:this.props.entryRenderThirdLine,
                    renderActions:this.props.entryRenderActions,
                    showSelector:showSelector,
                    selected:(this.state && this.state.selection)?this.state.selection.get(entry.node):false,
                    actions:<SimpleReactActionBar node={entry.node} actions={entry.actions} dataModel={this.dm}/>,
                    selectorDisabled:!(this.props.entryEnableSelector?this.props.entryEnableSelector(entry.node):entry.node.isLeaf())
                };
                if(this.props.elementStyle){
                    data['style'] = this.props.elementStyle;
                }
                if(this.props.passScrollingStateToChildren){
                    data['parentIsScrolling'] = this.state.isScrolling;
                }
                if(this.props.tableKeys){
                    if(this.state && this.state.groupBy){
                        data['tableKeys'] = LangUtils.deepCopy(this.props.tableKeys);
                        delete data['tableKeys'][this.state.groupBy];
                    }else{
                        data['tableKeys'] = this.props.tableKeys;
                    }
                    components.push(React.createElement(TableListEntry, data));
                }else{
                    components.push(React.createElement(ConfigurableListEntry, data));
                }
            }
        }.bind(this));
        return components;

    },

    buildElements: function(start, end, node, showSelector){
        var theNode = this.props.node;
        if (node) theNode = node;
        var theShowSelector = this.state && this.state.showSelector;
        if(showSelector !== undefined) theShowSelector = showSelector;

        if(!this.indexedElements) {
            this.indexedElements = [];
            if(this.state && this.state.groupBy){
                var groupBy = this.state.groupBy;
                var groups = {};
                var groupKeys = [];
            }

            if (!this.props.skipParentNavigation && theNode.getParent()
                && (this.props.dataModel.getContextNode() !== theNode || this.props.skipInternalDataModel)) {
                this.indexedElements.push({node: theNode.getParent(), parent: true, actions: null});
            }

            theNode.getChildren().forEach(function (child) {
                if(child.getMetadata().has('cursor')){
                    var childCursor = parseInt(child.getMetadata().get('cursor'));
                    this._currentCursor = Math.max((this._currentCursor ? this._currentCursor : 0), childCursor);
                }
                if(this.state && this.state.filterNodes && !this.state.filterNodes(child)){
                    return;
                }
                var nodeActions = this.getActionsForNode(this.dm, child);
                if(groupBy){
                    var groupValue = child.getMetadata().get(groupBy) || 'N/A';
                    if(!groups[groupValue]) {
                        groups[groupValue] = [];
                        groupKeys.push(groupValue);
                    }
                    groups[groupValue].push({node: child, parent: false, actions: nodeActions});
                }else{
                    this.indexedElements.push({node: child, parent: false, actions: nodeActions});
                }
            }.bind(this));

            if(groupBy){
                groupKeys = groupKeys.sort();
                groupKeys.map(function(k){
                    this.indexedElements.push({node: null, groupHeader:k, parent: false, actions: null});
                    this.indexedElements = this.indexedElements.concat(groups[k]);
                }.bind(this));
            }

        }

        if(this.state && this.state.sortingInfo && !this.remoteSortingInfo()){
            let sortingInfo = this.state.sortingInfo;
            let sortingMeta = sortingInfo.attribute;
            let sortingDirection = sortingInfo.direction;
            let sortingType = sortingInfo.sortType;
            this.indexedElements.sort(function(a, b){
                let aMeta = a.node.getMetadata().get(sortingMeta) || "";
                let bMeta = b.node.getMetadata().get(sortingMeta) || "";
                let res;
                if(sortingType === 'number'){
                    aMeta = parseFloat(aMeta);
                    bMeta = parseFloat(bMeta);
                    res  = (sortingDirection === 'asc' ? aMeta - bMeta : bMeta - aMeta);
                }else if(sortingType === 'string'){
                    res = (sortingDirection === 'asc'? aMeta.localeCompare(bMeta) : bMeta.localeCompare(aMeta));
                }
                if(res === 0){
                    // Resort by label to make it stable
                    let labComp = a.node.getLabel().localeCompare(b.node.getLabel());
                    res = (sortingDirection === 'asc' ? labComp : -labComp);
                }
                return res;
            });
        }

        if(this.props.elementPerLine > 1){
            end = end * this.props.elementPerLine;
            start = start * this.props.elementPerLine;
        }
        var nodes = this.indexedElements.slice(start, end);
        if(!nodes.length && theNode.getMetadata().get('paginationData')){
            /*
             //INFINITE SCROLLING ACCROSS PAGE. NOT SURE IT'S REALLY UX FRIENDLY FOR BIG LISTS OF USERS.
             //BUT COULD BE FOR E.G. LOGS
             var pData = theNode.getMetadata().get('paginationData');
             var total = parseInt(pData.get("total"));
             var current = parseInt(pData.get("current"));
             if(current < total){
             pData.set("new_page", current+1);
             }
             this.dm.requireContextChange(theNode);
             */
            return [];
        }else{
            return nodes; //this.buildElementsFromNodeEntries(nodes, theShowSelector);
        }
    },

    rebuildLoadedElements: function(){
        let newElements = this.buildElements(0, Math.max(this.state.elements.length, this.props.infiniteSliceCount));
        let infiniteLoadBeginBottomOffset = newElements.length? 200 : 0;
        this.setState({
            elements:newElements,
            infiniteLoadBeginBottomOffset:infiniteLoadBeginBottomOffset
        });
        this.updateInfiniteContainerHeight();
    },

    handleInfiniteLoad: function() {
        let elemLength = this.state.elements.length;
        let newElements = this.buildElements(elemLength, elemLength + this.props.infiniteSliceCount);
        let infiniteLoadBeginBottomOffset = newElements.length? 200 : 0;
        this.setState({
            isInfiniteLoading: false,
            elements: this.state.elements.concat(newElements),
            infiniteLoadBeginBottomOffset:infiniteLoadBeginBottomOffset
        });
    },

    /**
     * Extract remote sorting info from current node metadata
     */
    remoteSortingInfo: function(){
        let meta = this.props.node.getMetadata().get('paginationData');
        if(meta && meta.get('total') > 1 && meta.has('remote_order')){
            let col = meta.get('currentOrderCol');
            let dir = meta.get('currentOrderDir');
            if(col && dir){
                return {
                    remote: true,
                    attribute: col,
                    direction:dir
                };
            }
        }
        return null;
    },

    renderToolbar: function(){

        var rightButtons = [<ReactMUI.FontIcon
            key={1}
            tooltip="Reload"
            className={"icon-refresh" + (this.state.loading?" rotating":"")}
            onClick={this.reload}
        />];
        let i = 2;
        if(this.props.sortKeys){

            let sortingInfo, remoteSortingInfo = this.remoteSortingInfo();
            if(remoteSortingInfo){
                sortingInfo = remoteSortingInfo;
            }else{
                sortingInfo = this.state?this.state.sortingInfo:null;
            }
            rightButtons.push(<SortColumns
                key={i}
                displayMode="menu"
                tableKeys={this.props.sortKeys}
                columnClicked={this.onColumnSort}
                sortingInfo={sortingInfo}
            />);
            i++;
        }
        if(this.props.additionalActions){
            rightButtons.push(this.props.additionalActions);
        }

        var leftToolbar;
        var paginator;
        if(this.props.node.getMetadata().get("paginationData") && this.props.node.getMetadata().get("paginationData").get('total') > 1){
            paginator = (
                <ListPaginator dataModel={this.dm} node={this.props.node}/>
            );
        }

        if(this.props.listTitle){
            leftToolbar =(
                <ReactMUI.ToolbarGroup key={0} float="left">
                    <div className="list-title">{this.props.listTitle}</div>
                </ReactMUI.ToolbarGroup>
            );
        }

        if(this.props.searchResultData){

            leftToolbar =(
                <ReactMUI.ToolbarGroup key={0} float="left">
                    <h2 className="search-results-title">{this.context.getMessage('react.3').replace('%s', this.props.searchResultData.term)}</h2>
                </ReactMUI.ToolbarGroup>
            );
            rightButtons = <ReactMUI.RaisedButton key={1} label={this.context.getMessage('react.4')} primary={true} onClick={this.props.searchResultData.toggleState} />;

        }else if(this.actionsCache.multiple.size){
            var bulkLabel = this.context.getMessage('react.2');
            if(this.state.selection && this.state.showSelector){
                bulkLabel +=" (" + this.state.selection.size + ")";
            }
            leftToolbar = (
                <ReactMUI.ToolbarGroup key={0} float="left" className="hide-on-vertical-layout">
                    <ReactMUI.Checkbox ref="all_selector" onClick={this.selectAll}/>
                    <ReactMUI.FlatButton label={bulkLabel} onClick={this.toggleSelector} />
                </ReactMUI.ToolbarGroup>
            );

            if(this.state.showSelector) {
                rightButtons = [];
                var index = 0;
                this.actionsCache.multiple.forEach(function(a){
                    rightButtons.push(<ReactMUI.RaisedButton
                        key={index}
                        label={a.options.text}
                        data-action={a.options.name}
                        onClick={this.applyMultipleAction}
                        primary={true}/>
                    );
                }.bind(this));
                rightButtons = (<span>{rightButtons}</span>);

            }

        }

        return (
            <ReactMUI.Toolbar>
                {leftToolbar}
                <ReactMUI.ToolbarGroup key={1} float="right">
                    {paginator}
                    {rightButtons}
                </ReactMUI.ToolbarGroup>
            </ReactMUI.Toolbar>
        );

    },

    render: function(){

        var containerClasses = "material-list vertical-layout layout-fill";
        if(this.props.className){
            containerClasses += " " + this.props.className;
        }
        if(this.state.showSelector) {
            containerClasses += " list-show-selectors";
        }
        if(this.props.tableKeys){
            containerClasses += " table-mode";
        }
        var toolbar;
        if(this.props.tableKeys){
            var tableKeys;
            if(this.state && this.state.groupBy){
                tableKeys = LangUtils.deepCopy(this.props.tableKeys);
                delete tableKeys[this.state.groupBy];
            }else{
                tableKeys = this.props.tableKeys;
            }
            let sortingInfo, remoteSortingInfo = this.remoteSortingInfo();
            if(remoteSortingInfo){
                sortingInfo = remoteSortingInfo;
            }else{
                sortingInfo = this.state?this.state.sortingInfo:null;
            }
            toolbar = <TableListHeader
                tableKeys={tableKeys}
                loading={this.state.loading}
                reload={this.reload}
                ref="loading_indicator"
                dm={this.props.dataModel}
                node={this.props.node}
                additionalActions={this.props.additionalActions}
                onHeaderClick={this.onColumnSort}
                sortingInfo={sortingInfo}
            />
        }else{
            toolbar = this.props.customToolbar ? this.props.customToolbar : this.renderToolbar();
        }
        let inlineEditor;
        if(this.state.inlineEditionForNode){
            inlineEditor = <InlineEditor
                detached={true}
                node={this.state.inlineEditionForNode}
                callback={this.state.inlineEditionCallback}
                onClose={()=>{this.setState({inlineEditionForNode:null});}}
            />
        }

        var elements = this.buildElementsFromNodeEntries(this.state.elements, this.state.showSelector);
        return (
            <div className={containerClasses} onContextMenu={this.contextMenuResponder} tabIndex="0" onKeyDown={this.onKeyDown}>
                {toolbar}
                {inlineEditor}
                <div className={this.props.heightAutoWithMax?"infinite-parent-smooth-height":"layout-fill"} ref="infiniteParent">
                    <Infinite
                        elementHeight={this.state.elementHeight?this.state.elementHeight:this.props.elementHeight}
                        containerHeight={this.state.containerHeight ? this.state.containerHeight : 1}
                        infiniteLoadBeginEdgeOffset={this.state.infiniteLoadBeginBottomOffset}
                        onInfiniteLoad={this.handleInfiniteLoad}
                        handleScroll={this.onScroll}
                        ref="infinite"
                    >
                        {elements}
                    </Infinite>
                </div>
            </div>
        );
    }

});

export {SimpleList as default}