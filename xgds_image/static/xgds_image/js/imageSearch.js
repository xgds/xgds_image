function setMessage(message){
    $("#message").text(message);
}

function doSearch(event) {
    var theForm = this.$("#form-AbstractImageSet");
    var postData = theForm.serializeArray();
    postData.push({'name':'modelClass', 'value':'xgds_image.ImageSet'});
    setMessage("Searching..."); //set message (TODO) 
    event.preventDefault();
    $.ajax({
        url: '/xgds_map_server/doMapSearch',
        dataType: 'json',
        data: postData,
        success: $.proxy(function(data) {
            if (_.isUndefined(data) || data.length === 0){
                setMessage("None found.");
            } else {
            	imageSetsArray = data;
            	theDataTable.fnClearTable();
            	theDataTable.fnAddData(data);
                setMessage("");
                app.vent.trigger("mapSearch:found", data); 
            }
        }, this),
        error: $.proxy(function(data){
            app.vent.trigger("mapSearch:clear");
//            this.searchResultsView.reset();
            setMessage("Search failed.")
        }, this)
      });
}