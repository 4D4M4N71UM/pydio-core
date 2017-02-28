(function (global) {

    let pydio = global.pydio;

    let CompressionDialog = React.createClass({

        mixins:[
            PydioReactUI.ActionDialogMixin,
            PydioReactUI.CancelButtonProviderMixin,
            PydioReactUI.SubmitButtonProviderMixin
        ],

        getDefaultProps: function(){
            let formats = ['zip', 'tar', 'tar.gz', 'tar.bz2'];
            if(!global.pydio.Parameters.get('multipleFilesDownloadEnabled')){
                formats.pop();
            }
            return {
                dialogTitleId: 313,
                legendId: 314,
                dialogIsModal: true,
                formats: formats
            };
        },

        getInitialState: function(){

            let baseName;
            const {userSelection} = this.props;
            if(userSelection.isUnique()){
                baseName = PathUtils.getBasename(userSelection.getUniqueFileName());
                if(!userSelection.hasDir()) baseName = baseName.substr(0, baseName.lastIndexOf("\."));
            }else{
                baseName = PathUtils.getBasename(userSelection.getContextNode().getPath());
                if(baseName == "") baseName = "Archive";
            }
            let defaultCompression = this.props.formats[0];


            return {
                archiveBase:baseName,
                compression:defaultCompression,
                fileName: this.buildUniqueFileName(baseName, defaultCompression)
            }
        },

        buildUniqueFileName: function(base, extension){
            var index=1;
            let result = base;
            var buff = base;
            while(this.props.userSelection.fileNameExists(result + '.' + extension, true)){
                result = buff + "-" + index; index ++ ;
            }
            return result;
        },

        textFieldChange: function(event, newValue){
            this.setState({
                archiveBase:newValue,
                fileName: this.buildUniqueFileName(newValue, this.state.compression)
            });
        },

        selectFieldChange: function(event, index, payload){
            console.log(payload);
            this.setState({
                compression:payload,
                fileName: this.buildUniqueFileName(this.state.archiveBase, payload)
            });
        },

        submit(){
            const client = PydioApi.getClient();
            client.postSelectionWithAction(this.state.compression === 'zip' ? 'compress' : 'compression',
                function(transp){
                    client.parseXmlMessage(transp.responseXML);
                    this.dismiss();
                }.bind(this),
                this.props.userSelection,
                {
                    type_archive: this.state.compression,
                    archive_name: this.state.fileName + '.' + this.state.compression
                }
            );
        },

        render: function(){
            const formatMenus = this.props.formats.map(function(f){
                return <MaterialUI.MenuItem value={f} primaryText={'.' + f}/>
            });

            const messages = pydio.MessageHash;
            const {compression, fileName} = this.state;

            return (
                <div style={{display:'flex'}}>
                    <MaterialUI.TextField onChange={this.textFieldChange} value={fileName} floatingLabelText={messages['compression.4']}/>
                    <MaterialUI.SelectField onChange={this.selectFieldChange} value={compression} floatingLabelText={messages['compression.3']}>{formatMenus}</MaterialUI.SelectField>
                </div>
            );
        }

    });

    class Callbacks{

        static compressUI(){
            var userSelection = pydio.getUserSelection();
            if(!pydio.Parameters.get('multipleFilesDownloadEnabled')){
                return;
            }
            pydio.UI.openComponentInModal('CompressionActions', 'CompressionDialog', {userSelection:userSelection});

        }


        static extract(){
            console.log("Toto1?");
            var userSelection = pydio.getUserSelection();
            if (!userSelection.isEmpty()) {
                PydioApi.getClient().postSelectionWithAction('extraction', function(transport){
                    PydioApi.getClient().parseXmlMessage(transport.responseXML);
                }, userSelection);

            }
        }
    }

    global.CompressionActions = {
        CompressionDialog: CompressionDialog,
        Callbacks: Callbacks
    };

})(window);