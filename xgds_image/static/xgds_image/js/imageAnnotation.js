    var prefixUrl = '/static/openseadragon/built-openseadragon/openseadragon/images/';
    var viewer = OpenSeadragon({
        id:            "openseadragon1",
        prefixUrl:     prefixUrl,
        showNavigator: true,
        gestureSettingsMouse:   {
            clickToZoom: false
        },
        clickToZoom: "false",
        tileSources:   [{
            Image:  {
                //Need to change [tile_format="jpg", image_quality=0.85,]
                //Plus any other changes in deepzoom.py we make
                xmlns: "http://schemas.microsoft.com/deepzoom/2009",
                Url: "../../../../data/images/spacePics/ISS044-E-1998_files/",
                TileSize: "128",
                Overlap: "2",
                Format: "png",
                ServerFormat: "Default",
                Size: {
                    Width: "4928",
                    Height: "3280",
                }
            }
        }],
    });

    //fabricjs-openseadragon annotation object
    var overlay = viewer.fabricjsOverlay();
    var arrow, arrowTemp, line, rectangle, circle, ellipse, text, isDown, origX, origY;

    /*
    Stores annotation primary key to annotation json mappings for all annotations currently drawn on the canvas {pk: annotation json}
    Used to check if an annotation is on the canvas to prevent duplicate loadAnnotations() calls from the user
     */
    var annotationsDict = {};

    /* the mouse can be in 3 modes:
        1.) OSD (for interaction w/ OSD viewer, drag/scroll/zoom around the map
        2.) addAnnotation (disable OSD mode and enable click/drag on fabricJS canvas to draw an annotation)
        3.) editAnnotation (disable OSD mode and allow editing of existing annotations (but do not draw on clicK)
        getters and setters are below
     */
    var mouseMode = "OSD";

    // addRectToCanvas(1000, 1000);

    //Euclidean distance between (x1,y1) and (x2,y2)
    function distanceFormula(x1, y1, x2, y2) {
        var xDist = Math.pow((x1-x2),2);
        var yDist = Math.pow((y1-y2),2);
        return Math.sqrt(xDist+yDist);
    }

    function initializeLine(x, y) {
        line = new fabric.Line([x, y, x, y], {
            left: x,
            top: y,
            stroke: "red",
            strokeWidth: 15,
            originX: 'center',
            originY: 'center',
            type: 'line'
        });
        overlay.fabricCanvas().add(line)
    }

    function updateLineEndpoint(x, y) {
        line.set({x2:x, y2:y});
    }

    function initializeEllipse(x, y) {
        ellipse = new fabric.Ellipse({
            left: x,
            top: y,
            radius: 1,
            strokeWidth: 1,
            stroke: 'black',
            fill: 'white',
            selectable: true,
            originX: 'center',
            originY: 'center',
            type: 'ellipse'
        });
        overlay.fabricCanvas().add(ellipse);
    }

    function updateEllipse(x, y) {
        var distance = distanceFormula(x,y,origX,origY);

        ellipse.set({rx: Math.abs(origX-x), ry:Math.abs(origY-y)});
    }

    function initializeCircle(x, y) {
        circle = new fabric.Circle({
            left: x,
            top: y,
            radius: 1,
            strokeWidth: 1,
            stroke: 'black',
            fill: 'white',
            selectable: true,
            originX: 'center',
            originY: 'center',
            type: 'circle'
        });
        overlay.fabricCanvas().add(circle);
    }

    //TODO: should I update the circle member variable automatically or pass in the object to modify?
    function updateCircleRadius(x, y, origX, origY) {
        var radius = distanceFormula(x, y, origX, origY);
        circle.set({radius: radius});
    }

    function initializeRectangle(x, y) {
        rectangle = new fabric.Rect({
            left: x,
            top: y,
            fill: 'blue',
            width: 1,
            height: 1,
            type: 'rect'
        });
        overlay.fabricCanvas().add(rectangle);
    }

    function updateRectangleWidth(x, y, origX, origY) {
        var width = Math.abs(x-origX);
        var height = Math.abs(y-origY);
        rectangle.set({width: width, height: height});
    }

    function initializeText(x, y) {
        text = new fabric.Text("hello world", {
            left: x,
            top: y,
            type: 'text'
        });
        overlay.fabricCanvas().add(text);
    }

    function updateTextContent(x, y) {
        var width = Math.abs(x-origX);
        var height = Math.abs(y-origY);
        text.set({width: width, height: height})
    }

    /*
    Arrows are initialized in a strange way. Arrows aren't provided by fabricjs so you need to create them yourself. We do this by
    computing a group of points (in calculateArrowPoints()) and then creating a polygon that encloses all of those points (so we're
    really drawing a polygon, not an arrow). Taken from https://jsfiddle.net/6e17oxc3/
    */

    function drawArrow(x, y) {
        var headlen = 100;  // arrow head size
        arrow = new fabric.Polyline(calculateArrowPoints(origX,origY,x,y,headlen), {
            fill: 'white',
            stroke: 'black',
            opacity: 1,
            strokeWidth: 2,
            originX: 'left',
            originY: 'top',
            selectable: true,
            type: 'arrow'
        });
        overlay.fabricCanvas().add(arrow);
    }

    function updateArrow(x, y) {
        var headlen = 100; //arrow head size
        overlay.fabricCanvas().remove(arrow)
        var angle = Math.atan2(y - origY, x - origX);

        // bring the line end back some to account for arrow head.
        x = x - (headlen) * Math.cos(angle);
        y = y - (headlen) * Math.sin(angle);

        // calculate the points.
        var pointsArray = calculateArrowPoints(x, y, headlen);
        arrow = new fabric.Polyline(pointsArray, {
            fill: 'white',
            stroke: 'black',
            opacity: 1,
            strokeWidth: 2,
            originX: 'left',
            originY: 'top',
            selectable: true,
            type: 'arrow'
        });
        overlay.fabricCanvas().add(arrow);
        overlay.fabricCanvas().renderAll();
    }


    function calculateArrowPoints(x, y, headlen) {
        var angle = Math.atan2(y - origY, x - origX);
        var headlen = 100;  // arrow head size
        // bring the line end back some to account for arrow head.
        x = x - (headlen) * Math.cos(angle);
        y = y - (headlen) * Math.sin(angle);

        var points = [
		{
			x: origX,  // start point
			y: origY
		}, {
			x: origX - (headlen / 4) * Math.cos(angle - Math.PI / 2),
			y: origY - (headlen / 4) * Math.sin(angle - Math.PI / 2)
		},{
			x: x - (headlen / 4) * Math.cos(angle - Math.PI / 2),
			y: y - (headlen / 4) * Math.sin(angle - Math.PI / 2)
		}, {
			x: x - (headlen) * Math.cos(angle - Math.PI / 2),
			y: y - (headlen) * Math.sin(angle - Math.PI / 2)
		},{
			x: x + (headlen) * Math.cos(angle),  // tip
			y: y + (headlen) * Math.sin(angle)
		}, {
			x: x - (headlen) * Math.cos(angle + Math.PI / 2),
			y: y - (headlen) * Math.sin(angle + Math.PI / 2)
		}, {
			x: x - (headlen / 4) * Math.cos(angle + Math.PI / 2),
			y: y - (headlen / 4) * Math.sin(angle + Math.PI / 2)
		}, {
			x: origX - (headlen / 4) * Math.cos(angle + Math.PI / 2),
			y: origY - (headlen / 4) * Math.sin(angle + Math.PI / 2)
		},{
			x: origX,
			y: origY
		}
	];
        return points;
    }

    //fabricJS mouse-down event listener
    overlay.fabricCanvas().observe('mouse:down', function(o){
         console.log("EVENT TRIGERRED: fabricjs-mouse:down");
         console.log("mouse mode is " + getMouseMode());
         if(getMouseMode()=="addAnnotation") {
             isDown = true;
             var pointer = overlay.fabricCanvas().getPointer(o.e);
             origX = pointer.x;
             origY = pointer.y;
             // initializeCircle(pointer.x, pointer.y);
             // initializeRectangle(pointer.x, pointer.y);
             // initializeLine(pointer.x, pointer.y);
             // initializeEllipse(pointer.x, pointer.y);
             // initializeText(pointer.x, pointer.y);
             // initializeArrow(pointer.x, pointer.y);
             drawArrow(pointer.x, pointer.y);
         }
    });

    //fabricJS mouse-move event listener
    overlay.fabricCanvas().observe('mouse:move', function(o){
         if (!isDown) return;
         var pointer = overlay.fabricCanvas().getPointer(o.e);
         // updateCircleRadius(pointer.x, pointer.y, origX, origY); //do I need to pass this or can I access it as a member? in general, need to clarify b/w member obj.
         // updateRectangleWidth(pointer.x, pointer.y, origX, origY);
         // updateLineEndpoint(pointer.x, pointer.y);
         // updateEllipse(pointer.x, pointer.y);
         // updateTextContent(pointer.x, pointer.y);
         updateArrow(pointer.x, pointer.y);
         overlay.fabricCanvas().renderAll();
    });

    //fabricJS mouse-up event listener
    overlay.fabricCanvas().on('mouse:up', function(o){
        console.log("EVENT TRIGERRED: fabricj-mouse:up");
        if(getMouseMode()=="addAnnotation") {
            /* TODO:
            Might have to check annotationsDict here?
            Annoying because annotations here won't have a database pk

            If they save and immediately redraw you'll get a duplicate :/
             */
        }
        isDown = false;
    });

    //OSD event listener. Currently not really used.
    viewer.addHandler('canvas-click', function(event) {
        var pointer = overlay.fabricCanvas().getPointer(event.e);
        console.log("EVENT TRIGERRED: OSD-canvas-click")
    });

    //Toggle map scrolling button.
    $("#toggleMapScrolling").click(function() {
        console.log("toggle dat map scrolling boi");
        viewer.setMouseNavEnabled(false);
        setMouseMode("addAnnotation");
    })

    $("input[name='cursorMode']").change(function() {
        console.log("cursorMode change detected: " + $("input[name='cursorMode']:checked").val());
        var mode1 = $("input[name='cursorMode']").val();
        mode1="addAnnotation";
        setMouseMode(mode1);
    });

    $("input[name='annotationShape']").change(function(){
        console.log("annotationShape change detected: " + $("input[name='annotationShape']:checked").val());

    });

    overlay.fabricCanvas().on('object:modified', function() {
        updateSerialization(overlay.fabricCanvas().getActiveObject());
    });

    $("#addAnnotation").click(function() {
        setMouseMode("addAnnotation");
    });

    $('#loadAnnotation').click(function() {
       deserializeFromJSON();
    });

    $('#saveAnnotation').click(function() {
       serializeToJSON();
    });

    $('#editAnnotation').click(function() {
        setMouseMode("editAnnotation");
    });

    $('#deleteAnnotation').click(function() {
        deleteActiveAnnotation();
    });


    function setMouseMode(mode) {
        switch(mode) {
            case "OSD":
                console.log("mousemode: OSD");
            mouseMode="OSD";
                viewer.setMouseNavEnabled(true);
                break;
            case "addAnnotation":
                console.log("mousemode: addAnnotation");
                mouseMode="addAnnotation";
                viewer.setMouseNavEnabled(false); //if we're in addAnnotation mode, don't set isDown to true -- actually, ONLY set to true if mode is addAnnotation
                break;
            case "editAnnotation":
                console.log("mousemode: editAnnotation");
                mouseMode="editAnnotation";
                viewer.setMouseNavEnabled(false);
                break;
            default:
                console.log(mode);
                throw "Tried to set invalid mouse mode";
        }
    }

    function getMouseMode(){
        return mouseMode;
    }

    /* TODO: This is where we yolo and assume overlay.fabricCanvas().toJson() will preserve the order of the objects when it converts to json */
    function duplicateObject(object) {
        var objectCopy = {
            left: object["left"],
            top: object["top"],
            stroke: object["stokeWidth"],
            originX: object["originX"],
            originY: object["originY"],
            fill: object["fill"],
            angle: object["angle"],
            type: object["type"],
            pk: object["pk"],
            image: object["image"],
            points: object["points"] /* hacky fix */
        };
        /*TODO TODO TODO need to add parameters for ALL shapes rip */
        /* TODO TODO TODO TODO TODO OKAY SO THE STRINGIFY WORKS NOW JUST MAKE SURE WE HAVE ENOUGH PARAMETERS TO MATCH VIEWS.PY GODLBLESS*/
        return objectCopy;
    }

    function objectListToJsonList(list) {
        var retval = [];
        list.foreach(function(object){
           retval.push(duplicateObject(object));
        });
        return JSON.stringify(retval);
    }

    /* TODO
    RECAP: instead of passing in JSON.stringify(canvas) or JSON.stringify(object) we use its copy to avoid using fabricjs' toJSON functionality
     */
    function serializeToJSON() {
        console.log("attempting to serialize");
        // makeObjectCopy(JSON.stringify(overlay.fabricCanvas()));
        //TODOWILLDO
        $.ajax({
            type: "POST",
            url: '/xgds_image/saveAnnotations/', //TODO should be able to get this from url // maybe change the url/hard code it
            datatype: 'json',
            data: {
                mapAnnotations: JSON.stringify(overlay.fabricCanvas()), //TODO: can't just JSON.stringify, need to add our own fields
                // mapAnnotations: objectListToJsonList(overlay.fabricCanvas().getObjects()),
                image_pk: 1 // on the single image page it's app.options.modelPK, on the multi image page we have to get it from the selected item
            },
            success: function(data) {
                 console.log("ajax return call json " + data);
            },
            error: function(a,b,c,d) {
                console.log(a);
            }
        });
    }

    //TODO: should probably change the name of this function
    function deserializeFromJSON() {
        $.ajax({
            type: "POST",
            url: '/xgds_image/getAnnotations/1',
            datatype: 'json',
            success: function(data) {
                console.log(data);
                data.forEach(function(annotation) { //TODO: change name of the parameter
                    addAnnotationToCanvas(annotation);
                });
            },
            error: function(a,b,c,d) {
                console.log(a);
            }
        });
    }

    /* ugh should probably only re-serialize the modified object but that requires thinking */
    function updateSerialization(fabricObject) {
        console.log("serializing an individual fabric object");
        console.log("fabricObject")
        console.log(fabricObject);
        var temp = duplicateObject(fabricObject);
        console.log("temp");
        console.log(temp);
        console.log(JSON.stringify(temp));

        /* pass json and pk to updateEntry function? */
        //TODOWILLDO
        $.ajax({
            type: "POST",
            url: '/xgds_image/alterAnnotation/',
            datatype: 'json',
            data: {
                //annotation: Json.stringify(fabricObject),
                annotation: JSON.stringify(temp), //TODO: we're losing pk somewhere
                image_pk: 1
            },
            success: function(data) {

            },
            error: function(a) {
                console.log("Ajax error");
                console.log(a)
            }
        });
    }

    function getAnnotationColors() {
        $.ajax({
            type: "POST",
            url: '/xgds_image/getAnnotationColors/',
            datatype: 'json',
            success: function(data) {
                console.log(data);
            },
            error: function(a) {
                console.log("Ajax error");
                console.log(a)
            }
        });
    }

    /* TODO: I think delete annotationsDict[annotation["pk]] should delete the key from the dictionary
    so we can use (pk in annotationsDict) later. But it might just set the value to undefined? idk gotta test
     */
    function deleteActiveAnnotation() {
        var annotation = overlay.fabricCanvas.getActiveObject();
        if (annotation["pk"] in annotationsDict) {
            //TODO: remove from database
            $.ajax({
                type:"POST",
                url: '/xgds_image/deleteAnnotation/',
                datatype:"json",
                data: {
                  pk: annotation["pk"]
                },
                success: function(data) {
                    console.log(data);
                },
                error: function(a) {
                    console.log("Ajax error");
                    console.log(a)
                    throw new Error("Unable to delete the annotation's entry from the database");
                }
            });

            //delete from dict and database
            delete annotationsDict[annotation["pk"]];
            overlay.fabricCanvas.getActiveObject().remove();
        }else{
            //annotation not saved in database anyways, just remove from canvas
            overlay.fabricCanvas.getActiveObject().remove();
        }
    }

    /*
        Given an annotation model, add it to the canvas
     */
    function addAnnotationToCanvas(annotationJson) {
        if(annotationJson["pk"] in annotationsDict) {
            console.log("Annotation is already drawn on canvas, aborting load for this annotation");
            return;
        }else{ //otherwise, add annotation to annotationsDict and draw it by calling one of the addShapeToCanvas() functions below
            annotationsDict[annotationJson["pk"]] = annotationJson;
        }

        if(annotationJson["annotationType"]=="Rectangle") {
            addRectToCanvas(annotationJson);
        } else if(annotationJson["annotationType"]=="Ellipse") {
            addEllipseToCanvas(annotationJson);
        } else if(annotationJson["annotationType"]=="Arrow") {
            addArrowToCanvas(annotationJson);
        } else if(annotationJson["annotationType"]=="Text") {
            addTextToCanvas(annotationJson);
        }else{
            throw new Error("Tried to load an undefined shape to canvas (can only load rectangles, ellipses, arrows, lines");
        }
    }

    function addRectToCanvas(annotationJson) {
        console.log("Attempting to draw saved rectangle to canvas");
        var rect = new fabric.Rect({
            left: annotationJson["left"],
            top: annotationJson["top"],
            stroke: annotationJson["stokeWidth"],
            originX: annotationJson["originX"],
            originY: annotationJson["originY"],
            fill: "blue", //TODO: color dictionary reference isn't working, had to hard code it.
            angle: annotationJson["angle"],
            width: annotationJson["width"],
            height: annotationJson["height"],
            type: 'rect',
            pk: annotationJson["pk"],
            image: annotationJson["image"]
        });
        overlay.fabricCanvas().add(rect);
        overlay.fabricCanvas().renderAll();
    }

    function addEllipseToCanvas(annotationJson) {
        console.log("Attempting to draw saved ellipse to canvas");
        ellipse = new fabric.Ellipse({
            left: annotationJson["left"],
            top: annotationJson["top"],
            stroke: annotationJson["stokeWidth"],
            originX: annotationJson["originX"],
            originY: annotationJson["originY"],
            fill: annotationJson["fill"],
            angle: annotationJson["angle"],
            rx: annotationJson["radiusX"],
            ry: annotationJson["radiusY"],
            type: 'ellipse',
            pk: annotationJson["pk"],
            image: annotationJson["image"]
        });
        console.log("what does this pointer look like: " + annotationJson["fill"]);
        overlay.fabricCanvas().add(ellipse);
        overlay.fabricCanvas().renderAll();
    }

    function addArrowToCanvas(annotationJson) {
        arrow = new fabric.Polyline(JSON.parse(annotationJson["points"]), {
            left: annotationJson["left"],
            top: annotationJson["top"],
            stroke: annotationJson["stokeWidth"],
            originX: annotationJson["originX"],
            originY: annotationJson["originY"],
            fill: annotationJson["fill"],
            angle: annotationJson["angle"],
            type: 'arrow',
            pk: annotationJson["pk"],
            image: annotationJson["image"]
        });
        console.log("image and pk pls");
        JSON.stringify(overlay.fabricCanvas());
        overlay.fabricCanvas().add(arrow);
        overlay.fabricCanvas().renderAll();
    }

    function addTextToCanvas(annotationJson) {
        console.log("Attempting to draw saved text to canvas");
        text = new fabric.Text("hello world", {
            left: annotationJson["left"],
            top: annotationJson["top"],
            stroke: annotationJson["stokeWidth"],
            originX: annotationJson["originX"],
            originY: annotationJson["originY"],
            fill: annotationJson["fill"], //TODO: this is a pointer, need to access database to pull this color out
            angle: annotationJson["angle"],
            width: annotationJson["width"],
            height: annotationJson["height"],
            text: annotationJson["content"], //text should be the right field here
            type: 'text',
            pk: annotationJson["pk"],
            image: annotationJson["image"]
        });
        overlay.fabricCanvas().add(text);
        overlay.fabricCanvas().renderAll();
    }

    //create a new circle and add it to canvas
    //TODO: still need to add standardized attribute/json list
    function addCircleToCanvas(x, y) {
        // var circle = new fabric.Circle({
        //     left: x,
        //     top: y,
        //     radius: 225,
        //     strokeWidth: 1,
        //     stroke: 'black',
        //     fill: 'white',
        //     selectable: true,
        //     originX: 'center', originY: 'center'
        // });
        // overlay.fabricCanvas().add(circle);
        // overlay.fabricCanvas().renderAll();
    }

/*
TODO: edit, delete, pk
edit/delete: mouse modes for manipulating annotations
pk: store pk's in a pk-json dictionary to prevent duplicate loads and to manipulate from annotations list
 */

/* TODO:
mouse modes
serialization
color pallete
xgds ref
*/

/*
TODO: still have an ajax error
TODO: colors dictionary
TODO: add mouse modes
TODO: add color picker
TODO: convert to namespace (entire thing or split into smaller namespaces?)
TODO: add try catch to views.py
TODO: monitor
left, top, strokewidth, strokecolor, originX, originY, fill, angle <---- SHOULD ADD SELECTABLE

line: default
ellipse: rx, ry instead of radius
circle: radius
rect: width, height
text: width, height, content
arrow: points, type?

 */




















