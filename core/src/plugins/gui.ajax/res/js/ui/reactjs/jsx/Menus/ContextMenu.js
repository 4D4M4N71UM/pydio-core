import ContextMenuModel from './ContextMenuModel'
import Utils from './Utils'
import PopupMenu from './PopupMenu'

(function(global){

    const dims = {
        MENU_ITEM_HEIGHT: 48,
        MENU_SEP_HEIGHT: 9,
        MENU_VERTICAL_PADDING: 8,
        MENU_WIDTH: 250
    };

    export default React.createClass({


        modelOpen: function(node){
            let position = ContextMenuModel.getInstance().getPosition();
            let items;
            if(node){
                let dm = pydio.getContextHolder();
                if(dm.isUnique() && dm.getUniqueNode() === node){
                    this.openMenu('selectionContext', position);
                }else{
                    pydio.observeOnce("actions_refreshed", function(dataModel){
                        this.openMenu('selectionContext', position);
                    }.bind(this));
                    dm.setSelectedNodes([node]);
                }
            }else{
                this.openMenu('genericContext', position);
            }
        },

        openMenu: function(context, position){
            let items = this.computeMenuItems(context);
            position = this.computeVisiblePosition(position, items);
            this.refs['menu'].showMenu({
                top: position.y,
                left: position.x
            }, items);
        },

        computeMenuItems: function(context){
            let actions = global.pydio.Controller.getContextActions(context, ['inline', 'info_panel', 'info_panel_share']);
            return Utils.pydioActionsToItems(actions);
        },

        menuClicked: function(object){
            object.payload();
        },

        computeVisiblePosition: function(position, items){
            let menuHeight  = dims.MENU_VERTICAL_PADDING * 2;
            items.map(function(it){
                if(it.type === ReactMUI.MenuItem.Types.SUBHEADER) menuHeight += dims.MENU_SEP_HEIGHT;
                else menuHeight += dims.MENU_ITEM_HEIGHT;
            });
            let menuWidth   = dims.MENU_WIDTH;
            let windowW     = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
            let windowH     = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
            if(position.x + menuWidth > windowW) position.x = Math.max(position.x - menuWidth, 10);
            if(position.y + menuHeight > windowH) position.y = Math.max(position.y - menuHeight, 10);
            return position;
        },

        onMenuClosed: function(){
            ContextMenuModel.getInstance().close();
        },

        componentDidMount: function(){
            if(global.pydio.UI.contextMenu){
                // Make sure "contextmenu" events are not stopped
                // by proto.menu.
                // TO BE REMOVED when no more PrototypeJS.
                global.pydio.UI.contextMenu.destroy();
                delete global.pydio.UI.contextMenu;
            }
            this._modelOpen = this.modelOpen;
            ContextMenuModel.getInstance().observe("open", this._modelOpen);
        },

        componentWillUnmount: function(){
            ContextMenuModel.getInstance().stopObserving("open", this._modelOpen);
        },

        render: function(){
            return (
                <PopupMenu
                    ref="menu"
                    menuItems={[]}
                    onMenuClicked={this.menuClicked}
                    onMenuClosed={this.props.onMenuClosed}
                />
            );
        }
    });


})(window);