function initializeWithSpew(spew) {

    const scraper = new InferScraper.Scraper(spew);

    /* Highlight bubble constants. */
    const hMargin = 2;
    const wMargin = 2;
    const border = 4;

    function removeBubble() {
        var bubble = $("#bubble");
        var el = $("#" + bubble.attr("data-under"));

        bubble.remove();

        el.removeAttr("style");
        el.addClass("clickableTypeset");
        el.click(clickSourceTypeset);
        var kids = el.find("span");
        kids.addClass("clickableTypeset");
        kids.click(clickSourceTypeset);
    }

    /* |el| is the element to show the bubble around. */
    function showBubble(el) {
        if (el.length === 0)
            return;

        /* Remove the old bubble. */
        removeBubble();

	/* Make a new bubble. */
        var id = el.attr("id");
	el.after("<div id=\"bubble\" data-under=\"" + id + "\" class=\"bubble\"></div>");
	/* Position it. */
	var bubble = $("#bubble");
	var offset = el.offset();
	var h = el.height();
	var w = el.width();
        var codeLeft = $("#code").offset().left;
	bubble.css({ height: (h + 2 * hMargin) + "px",
		     width: (w + 2 * wMargin) + "px",
		     left: (offset.left - wMargin - border - codeLeft) + "px",
		     top: (offset.top - hMargin - border) + "px" });
        bubble.show();

	el.css({ position: "relative", "z-index": 1000 });
        el.removeClass("clickableTypeset");
        el.unbind("click");
        var kids = el.find("span");
        kids.removeClass("clickableTypeset");
        kids.unbind("click");
    }

    function toggleClickable(el, klass, f) {
        var prev = $("." + klass);
        prev.click(f);
        prev.removeClass(klass);
        el.addClass(klass);
        el.unbind("click");
    }

    function listTypes(id, selected) {
        var types = [];
        var c;
        for (var t in scraper.typesets[id].types) {
            c = (t === selected ? "selected" : "unselected");
            types.push("<li class=\"" + c + "\">" + t + "</li>");
        }
        return "<ul class=\"set\">" + types.join("") + "</ul>";
    }

    function showTypesetAsCurrent(id) {
        var el = $("#typeset");
        el.html("<h3>" + id + "</h3>");
        el.append(listTypes(id));
        el.addClass("highlight");
        $("#typeset li").click(clickType);
        $("#path").html("");
    }

    function clickSourceTypeset(e) {
        /*
         * The typeset spans may be deeply nested. We don't propagate up the
         * DOM and only handle the innermost span.
         */
        var el = $(this);
        var id = el.attr("id");

        showTypesetAsCurrent(id);
        showBubble(el);

        e.stopPropagation();
    }

    function clickTypeset(e) {
        var el = $(this);
        $(".notFound").removeClass(".notFound");
        toggleClickable(el, "highlight", clickTypeset);
        showBubble($("#" + el.attr("data-display-id")));
    }

    function clickType(e) {
        toggleClickable($(this), "selected", clickType);

        var el = $("#path");
        var type = $(this).html().replace("&lt;", "<").replace("&gt;", ">");
        var pobj = scraper.pathOf($("#typeset > h3").html(), type);
        var path = pobj.path;
        var id, displayId;

        el.html("");
        if (path) {
            /* We are sure #typeset is in the source text. */
            displayId = "typeset";
            for (var i = 0; i < path.length; i++) {
                id = path[i].source;
                /*
                 * If the typeset isn't shown in the decompiled source,
                 * use the last typeset that we know is in the source.
                 */
                if ($("#" + id).length !== 0)
                    displayId = id;
                el.append("<div class=\"subset\" title=\"" + path[i].kind + "\">&supe;</div>");
                el.append("<div class=\"superset\" data-display-id=\"" + displayId + "\">" +
                          "<h3>" + id + "<h3>" + listTypes(id, type) +
                          "</div>");
            }
        }

        switch (pobj.origin) {
        case InferScraper.DYNAMIC_ORIGIN:
            el.append("<div id=\"origin\">&hellip;which was determined dynamically</div>");
            break;

        case InferScraper.STATIC_ORIGIN:
            el.append("<div id=\"origin\">&hellip;which was determined statically</div>");
            break;

        default:
            el.append("<div id=\"origin\">...and the trail runs cold</div>");
            break;
        }

        $("#path .superset").click(clickTypeset);
    }

    function reset() {
        $("#typeset").html("");
        $("#typeset").removeClass("highlight");
        $("#path").html("");

        removeBubble();
    }

    /* Setup up the spans to have the right classes. */
    var codespans = $("#code span");
    codespans.addClass("clickableTypeset");
    codespans.click(clickSourceTypeset);

}
