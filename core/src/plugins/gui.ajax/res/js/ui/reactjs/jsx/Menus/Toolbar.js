import Utils from './Utils'
import IconButtonMenu from './IconButtonMenu'
import ButtonMenu from './ButtonMenu'

(function(global){

    export default React.createClass({

        propTypes:{
            toolbars:React.PropTypes.array,
            groupOtherList:React.PropTypes.array,
            renderingType:React.PropTypes.string,
            controller:React.PropTypes.instanceOf(Controller)
        },

        componentDidMount: function(){
            this._observer = function(){
                if(!this.isMounted()) return;
                this.setState({
                    groups:this.props.controller.getToolbarsActions(this.props.toolbars, this.props.groupOtherList)
                });
            }.bind(this);
            if(this.props.controller === pydio.Controller){
                pydio.observe("actions_refreshed", this._observer);
            }else{
                this.props.controller.observe("actions_refreshed", this._observer);
            }
        },

        componentWillUnmount: function(){
            if(this.props.controller === pydio.Controller){
                pydio.stopObserving("actions_refreshed", this._observer);
            }else {
                this.props.controller.stopObserving("actions_refreshed", this._observer);
            }
        },

        getInitialState: function(){
            return {
                groups:this.props.controller.getToolbarsActions(this.props.toolbars, this.props.groupOtherList)
            };
        },

        getDefaultProps:function(){
            return {
                controller: global.pydio.Controller,
                renderingType:'button',
                groupOtherList:[]
            }
        },

        render: function(){
            let groups = this.state.groups
            let actions = [];
            let toolbars = this.props.toolbars;
            if(this.props.groupOtherList.length){
                toolbars = toolbars.concat(['MORE_ACTION']);
            }
            let renderingType = this.props.renderingType;
            toolbars.map(function(barName){
                if(!groups.has(barName)) return;
                groups.get(barName).map(function(action){
                    if(action.deny) return;
                    let menuItems = null;
                    let menuTitle = null;
                    let menuIcon  = null;
                    let actionName = action.options.name;

                    if(barName === 'MORE_ACTION') {
                        let subItems = action.subMenuItems.dynamicItems;
                        let items = [];
                        subItems.map(function (obj) {
                            if (obj.separator) {
                                items.push(obj);
                            } else if (obj.actionId) {
                                items.push(obj.actionId.getMenuData());
                            }
                        });
                        menuTitle = "More";
                        menuItems = Utils.pydioActionsToItems(items);
                        menuIcon  = "icon icon-plus";
                    }else if(action.subMenuItems.staticItems){
                        menuTitle = action.options.text;
                        menuItems = Utils.pydioActionsToItems(action.subMenuItems.staticItems);
                        menuIcon  = action.options.icon_class;
                    }else if(action.subMenuItems.dynamicBuilder){
                        menuTitle = action.options.text;
                        menuIcon  = action.options.icon_class;
                        menuItems = Utils.pydioActionsToItems(action.subMenuItems.dynamicBuilder());
                    }else{
                        menuTitle = action.options.text;
                        menuIcon  = action.options.icon_class;
                    }
                    let id = 'action-' + action.options.name;
                    if(renderingType === 'button-icon'){
                        menuTitle = <span className="button-icon"><span className={"button-icon-icon " + menuIcon}></span><span className="button-icon-label">{menuTitle}</span></span>;
                    }
                    if(menuItems){
                        if(renderingType === 'button' || renderingType === 'button-icon'){
                            actions.push(<ButtonMenu
                                key={actionName}
                                className={id}
                                buttonTitle={menuTitle}
                                menuItems={menuItems}/>);
                        }else{
                            actions.push(<IconButtonMenu
                                key={actionName}
                                className={id}
                                onMenuClicked={function(object){object.payload()}}
                                buttonClassName={menuIcon}
                                buttonTitle={menuTitle}
                                menuItems={menuItems}/>);
                        }
                    }else{
                        let click = function(synthEvent){action.apply();};
                        if(renderingType === 'button' || renderingType === 'button-icon'){
                            actions.push(<ReactMUI.FlatButton
                                key={actionName}
                                className={id}
                                onClick={click}
                                label={menuTitle}/>);
                        }else{
                            actions.push(<ReactMUI.IconButton
                                key={actionName}
                                className={menuIcon + ' ' + id}
                                onClick={click}
                                label={menuTitle}/>);
                        }
                    }
                });
            });
            let cName = this.props.className ? this.props.className : '';
            cName += ' ' + 'toolbar';
            return <div className={cName} id={this.props.id}>{actions}</div>
        }

    });

})(window);