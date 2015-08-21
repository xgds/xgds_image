var $container = $('#container'); 

/**
 * Helpers
 */
function createPackeryItem(title, id, width){
	//create a div that displays this imageView
	var elem = document.createElement('div');
	elem.className='item ' + width + ' lockAspect';
	elem.id= id;
	elem.innerHTML = "<div><strong>"+ title +"</strong></div>";
	return elem;
}


function appendItem(elem){
	//append to container
	$container.append( elem );
	$container.packery('appended', elem);

	// call make resizeable again
	makeResizable($container);
}


// creates a label anda appends to form
function createLabel(labelText, form) {
	var label = document.createElement('label');
	label.innerHTML = labelText;
	form.appendChild(label);
}

// creates select box and appends to form
function createSelectBox(options, id, form) {
	//Create select list
	var selectList = document.createElement("select");
	selectList.id = id;

	//Create and append the options
	for (var i = 0; i < options.length; i++) {
	    var option = document.createElement("option");
	    option.value = options[i];
	    option.text = options[i];
	    selectList.appendChild(option);
	}
	
	form.appendChild(selectList);
	
	var br = document.createElement('br');
	form.appendChild(br);
}


// creates text input field and appends to form
function createInput(id, form) {
	var inputBox = document.createElement("input");
	inputBox.id = id;
	form.appendChild(inputBox);
	var br = document.createElement('br');
	form.appendChild(br);
}

// creates text area and appends to form
function createTextarea(id, form) {
	var textArea = document.createElement("textarea");
	textArea.id = id
	form.appendChild(textArea);
	var br = document.createElement('br');
	form.appendChild(br);
}

function createCloseBtn(form) {
	var i = document.createElement('i');
	i.className = "fa fa-lg fa-times-circle";
	i.addEventListener("click", function(event){
		// remove clicked element
		$container.packery( 'remove', event.target.parentElement );
		// layout remaining item elements
		$container.packery();
	});
	form.appendChild(i);
}


/*
 * Views
 */
function imageView(imageName, imagePath) {
	/**
	 * If the view doesn't exist, create one. 
	 */
	var elem = createPackeryItem(imageName, 'item_image_view', 'w2');
	$('<img src="'+ imagePath +'">').appendTo(elem);
	
	//image description
	var descriptionDiv = document.createElement('div');
	descriptionDiv.innerHTML = "Source: dummy source, Author: Jane Doe, Altitude: 5800ft";
	elem.appendChild(descriptionDiv);
	
	//more info html link
	var a = document.createElement('a');
	a.href =  "javascript:moreInfoView(\""+ imageName +"\");"; 
	a.innerHTML = 'More info'
	elem.appendChild(a);
	
	// close btn
	createCloseBtn(elem);
	
	//append to container
	appendItem(elem);
}


// creates a select box and attaches it to the form
function moreInfoView(imageName) {
	var elem = createPackeryItem(imageName, 'item_image_info_view', 'w3');
	var formLayout = document.createElement('div');
	formLayout.className = "formLayout";
	
	var sourceArray = ["dummy1", "dummy2", "dummy3"];
	createLabel("Source", formLayout);
	createSelectBox(sourceArray, "source", formLayout);
	
	var locationArray = ["location1", "location2", "location3"];
	createLabel("Location", formLayout);
	createSelectBox(locationArray, "location", formLayout); 
	
	createLabel("Latitude", formLayout);
	createInput("latitude", formLayout);
	
	createLabel("Longitude", formLayout);
	createInput("longitude", formLayout);

	createLabel("Altitude", formLayout);
	createInput("altitude", formLayout);
	
	var authorArray = ["author1", "author2", "author3"];
	createLabel("Author", formLayout);
	createSelectBox(authorArray, "author", formLayout); 
	
	createLabel("Description", formLayout);
	createTextarea("description", formLayout);
	
    var submitBtn = document.createElement("INPUT");
    submitBtn.setAttribute("type", "submit");
	formLayout.appendChild(submitBtn);

	elem.appendChild(formLayout);
	
	// close btn
	createCloseBtn(elem);
	
	appendItem(elem);
}

/* 
 * Table View
 */
//images table
defaultOptions["columnDefs"] = [{ "width": "150", "targets": 0 }];
var imageTable = $('#image_table').DataTable(defaultOptions);

// give path, construct an html link
function createLink(path) {
	var imgName = path.split('/');
	imgName = imgName[imgName.length-1];
	return "<a href='javascript:imageView(\"" + imgName + "\",\"" + path + "\");'>" + imgName + "</a>";
}

// add rows to the table on page load.
$(images).each(function(){
	var imageUrl = createLink(this['imageUrl']);
	imageTable.row.add([imageUrl, this['creation_time'], 'dummy source', 
	                    'dummy lat', 'dummy lon', 'dummy alt']).draw();
});


/*
 * Image drag and drop upload
 */
Dropzone.options.imageDropZone = {
	// Prevents Dropzone from uploading dropped files immediately
	autoProcessQueue : false,

	//	acceptedFiles: 'application/image',
	init : function() {
		var submitButton = document.querySelector("#submit-all")
		imageDropZone = this;

		submitButton.addEventListener("click", function() {
			imageDropZone.processQueue();  // Tell Dropzone to process all queued files.
		});

		// You might want to show the submit button only when
		// files are dropped here:
		this.on("addedfile", function() {
			// Show submit button here and/or inform user to click it.
		});
		
		this.on("success", function(file, responseText, e) {
			imageJson = responseText['json'];
			var imageUrl = createLink(imageJson['imageUrl']);
			imageTable.row.add([imageUrl, imageJson['creation_time'], 'dummy source', 
			                    'dummy lat', 'dummy lon', 'dummy alt']).draw();
		});
	}
};