/*
 * Type Inference Spew Scraper
 *
 * Contributors(s):
 *   Shu-yu Guo <shu@rfrn.org>, 2011.
 *
 * This file is in the Public Domain.
 */

var InferScraper = (function () {

    function BadSpewError(msg) {
        this.msg = msg;
    }

    BadSpewError.prototype = {
        toString: function() {
            return this.msg;
        }
    };

    function BadSpew(msg) {
        throw new BadSpewError(msg);
    }

    const UNKNOWN_ORIGIN = 0;
    const DYNAMIC_ORIGIN = 1;
    const STATIC_ORIGIN  = 2;

    const ADDTYPE = 0;
    const ADDCONSTRAINT = 1;
    const RESOLVE = 2;
    const ANALYZE = 3;
    const BYTECODETYPE = 4;
    const TYPESET = 5;

    /*
     * Infer formats. Ellipses mean `anything'.
     *
     *  addType: {typeset} {type}
     *  addConstraint: {typeset} {constraint} {constraint-kind}
     *  resolve: {constraint} {type}
     *  analyze: {loc}
     *  bytecodeType: {loc}: {type}
     *  typeSet: {typeset} ...
     */
    const ADDTYPE_FMT = /^\[infer\] addType: (\S+) (\S+)$/;
    const ADDCONSTRAINT_FMT = /^\[infer\] addConstraint: (\S+) (\S+) (\S+)$/;
    const RESOLVE_FMT = /^\[infer\] resolve: (\S+) (\S+)$/;
    const ANALYZE_FMT = /^\[infer\] analyze: (\S+)$/;
    const BYTECODETYPE_FMT = /^\[infer\] bytecodeType: (\S+): (\S+)$/;
    const TYPESET_FMT = /^\[infer\] typeSet: (\S+)/;

    function InferSpewOp(line) {
        if (match = ADDTYPE_FMT.exec(line)) {
            this.kind = ADDTYPE;
            this.target = match[1];
            this.type = match[2];
        }

        if (match = ADDCONSTRAINT_FMT.exec(line)) {
            this.kind = ADDCONSTRAINT;
            /* The `target' is the source of the constraint. */
            this.target = match[1];
            this.constraint = match[2];
            this.constraint_kind = match[3];
        }

        if (match = RESOLVE_FMT.exec(line)) {
            this.kind = RESOLVE;
            this.constraint = match[1];
            this.type = match[2];
        }

        if (match = ANALYZE_FMT.exec(line)) {
            this.kind = ANALYZE;
            this.loc = match[1];
        }

        if (match = BYTECODETYPE_FMT.exec(line)) {
            this.kind = BYTECODETYPE;
            this.loc = match[1];
            this.type = match[2];
        }

        if (match = TYPESET_FMT.exec(line)) {
            this.kind = TYPESET;
            this.typeset = match[1];
        }
    }

    function TypeSet() {
        this.types = {};
    }

    TypeSet.prototype = {
        addType: function(type, src) {
            /* Where the type came from. */
            this.types[type] = src;
        },

        hasType: function(type) {
            return type in this.types;
        },

        typeFrom: function(type) {
            return this.types[type];
        }
    };

    function Constraint(kind, source) {
        this.kind = kind;
        this.source = source;
    }

    function Scraper(spewBuf) {
        var lines = spewBuf.split(/\n/);
        var line;

        /*
         * First do a forward pass to allocate the typesets and constraints.
         */
        this.typesets = {};
        this.constraints = {};

        var spew = [];
        var op;

        while ((line = lines.shift()) !== undefined) {
            op = new InferSpewOp(line);
            /* Only accumulate the lines we understand. */
            switch (op.kind) {
            case TYPESET:
                this.typesets[op.typeset] = new TypeSet();
                spew.push(op);
                break;

            case ADDCONSTRAINT:
                this.constraints[op.constraint] =
                    new Constraint(op.constraint_kind, op.target);
                spew.push(op);
                break;

            default:
                if (op.kind !== undefined)
                    spew.push(op);
                break;
            }
        }

        /*
         * We walk backwards from the bottom to compute the flows-to graph.
         *
         * Roughly, the nodes are typesets and the edges are constraints.
         *
         * With evey addType is associated the most recent resolve, analyze,
         * or bytecodeType, telling us how the type was added.
         */
        var addQueue = [];
        var add;
        while (spew.length) {
            op = spew.pop();

            switch (op.kind) {
            case ADDTYPE:
                if (!this.typesets[op.target])
                    BadSpew("adding type to nonexistent typeset");
                addQueue.push(op);
                break;

            case RESOLVE:
                if (addQueue.length === 1) {
                    add = addQueue.pop();
                    var constraint = this.constraints[op.constraint];
                    if (!constraint)
                        BadSpew("resolving nonexistent constraint");
                    this.typesets[add.target].addType(add.type, constraint);
                }
                break;

            case ANALYZE:
                while (add = addQueue.pop()) {
                    this.typesets[add.target].addType(add.type, STATIC_ORIGIN);
                }
                break;

            case BYTECODETYPE:
                while (add = addQueue.pop()) {
                    this.typesets[add.target].addType(add.type, DYNAMIC_ORIGIN);
                }
                break;

            default:
                break;
            }
        }
    }

    Scraper.prototype = {
        pathOf: function(typesetId, type) {
            var typeset = this.typesets[typesetId];
            if (!typeset || !typeset.hasType(type))
                return [];

            var path = [];
            var from = typeset.typeFrom(type);

            while (from instanceof Constraint) {
                path.push(from);
                from = this.typesets[from.source].typeFrom(type);
            }
            /* The last node should be an origin. */
            var origin = from;
            if (origin != DYNAMIC_ORIGIN && origin != STATIC_ORIGIN)
                origin = UNKNOWN_ORIGIN;

            return { origin: origin, path: path };
        }
    };

    return {
        UNKNOWN_ORIGIN: UNKNOWN_ORIGIN,
        DYNAMIC_ORIGIN: DYNAMIC_ORIGIN,
        STATIC_ORIGIN: STATIC_ORIGIN,
        Scraper: Scraper
    };

})();