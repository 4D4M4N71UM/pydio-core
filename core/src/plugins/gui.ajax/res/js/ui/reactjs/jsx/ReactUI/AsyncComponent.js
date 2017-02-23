import Loader from './Loader'
/********************/
/* ASYNC COMPONENTS */
/********************/
/**
 * Load a component from server (if not already loaded) based on its namespace.
 */
const AsyncComponent = React.createClass({

    propTypes: {
        namespace:React.PropTypes.string.isRequired,
        componentName:React.PropTypes.string.isRequired,
        noLoader:React.PropTypes.bool
    },

    _asyncLoad:function(){
        ResourcesManager.loadClassesAndApply([this.props.namespace], function(){
            this.setState({loaded:true});
            if(this.refs['component'] && this.props.onLoad && !this.loadFired){
                this.props.onLoad(this.refs['component']);
                this.loadFired = true;
            }
        }.bind(this));
    },

    componentDidMount: function() {
        this._asyncLoad();
    },

    componentWillReceiveProps:function(newProps) {
        if(this.props.namespace != newProps.namespace){
            this.loadFired = false;
            this.setState({loaded:false});
        }
    },

    componentDidUpdate:function() {
        if(!this.state.loaded){
            this._asyncLoad();
        }else{
            if(this.refs['component'] && this.props.onLoad && !this.loadFired){
                this.props.onLoad(this.refs['component']);
                this.loadFired = true;
            }
        }
    },

    getInitialState: function() {
        return {loaded: false};
    },

    getComponent:function() {
        return (this.refs.component ? this.refs.component : null);
    },

    render: function() {
        if(this.state && this.state.loaded) {
            var nsObject = window[this.props.namespace];
            if(nsObject && nsObject[this.props.componentName]){
                let props = LangUtils.simpleCopy(this.props);
                if(props.loaderStyle){
                    delete props['loaderStyle'];
                }
                if(this.props.modalData && this.props.modalData.payload){
                    props = Object.assign(props, this.props.modalData.payload);
                }
                props['ref'] = 'component';
                return React.createElement(nsObject[this.props.componentName], props);
            }else{
                return <div>Component {this.props.namespace}.{this.props.componentName} not found!</div>;
            }
        }else if(!this.props.noLoader){
            return <Loader style={this.props.loaderStyle}/>;
        }else{
            return null;
        }
    }
});

export {AsyncComponent as default}
