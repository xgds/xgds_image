function doSearch() {
    var theForm = this.$("#form-AbstractImageSet");
    var postData = theForm.serializeArray();
    this.setMessage("Searching..."); //set message (TODO) 
    $.ajax({
        url: '/xgds_map_server/doMapSearch',
        dataType: 'json',
        data: postData,
        success: $.proxy(function(data) {
            if (_.isUndefined(data) || data.length === 0){
                this.setMessage("None found.");
            } else {
            	//TODO: update contents of the search table.
            	//TODO: update the map
                this.searchResultsView.updateContents(this.selectedModel, data);
                this.clearMessage();
            }
        }, this),
        error: $.proxy(function(data){
            app.vent.trigger("mapSearch:clear");
            this.searchResultsView.reset();
            this.setMessage("Search failed.")
        }, this)
      });
}