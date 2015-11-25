function updateTableScrollY(divID, tableID) {
    var divItem = $('#' + divID);
    var parentHeight = divItem.height();
    divItem.find('.dataTables_scrollBody').height(parentHeight-110);
    theDataTable.fnAdjustColumnSizing();
}

/* 
 * Table View
 */
function setupTable(divID, tableID){
	// initialize the image table with json of existing images.
	defaultOptions["aaData"] = imageSetsArray;
	defaultOptions["aoColumns"] = [
	                               {"mRender": function(data, type, full) {
	                            	   return "<img src='"+full['thumbnail_image_url']+"' width='130'></img>"
	                               }},
	                               {"mRender":function(data, type, full){
	                            	   var imageName = full['name'];
	                            	   var jsonString = JSON.stringify(full);
	                                   return "<a onclick='constructImageView(" + jsonString + ")'>"+ imageName +"</a>";
	                               }},
	                               {"mData": "camera_name"},
	                               {"mData": "creation_time"},
	                               {"mData": "lat"},
	                               {"mData": "lon"},
	                               {"mData": "altitude"},
	                               {"mData": "author_name"},
	];
	defaultOptions["scrollY"] = 200;

	if ( ! $.fn.DataTable.isDataTable( '#' + tableID ) ) {
		  theDataTable = $('#' + tableID ).dataTable(defaultOptions);
	}
	
	// handle resizing
	var tableResizeTimeout;
	$('#' + divID).resize(function() {
	    // debounce
	    if ( tableResizeTimeout ) {
		clearTimeout( tableResizeTimeout );
	    }

	    tableResizeTimeout = setTimeout( function() {
		updateTableScrollY(divID, tableID);
	    }, 30 );
	});
	
}