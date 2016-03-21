function Node(name, parent, childrens) {
    var self = this;

    this.parent = parent || null;
    this.childrens = childrens || [];
    this.data = {name: name};

    this.path = function() {
        function path(node) {
            if (node.parent === null) {
                return node.data.name;
            }

            return path(node.parent) + '/' + node.data.name;
        }

        return path(self)
    }
}

function Tree() {
    var self = this;

    this.root = new Node('');


    this.asArray = function() {
        var arr = [];

        var idmap = {};

        function asArray(node) {
            if (node.childrens) {
                node.childrens.forEach(function(child_node){
                    asArray(child_node);
                });
            }

            var name = node.path();

            if (name in idmap || !node.parent) return;

            // Убрать костыль, подумать над норм id-шниками
            var is_root = node.parent.path() =='';
            var is_leaf = node.childrens.length == 0;
            var is_folder = !is_leaf && !is_root;

            var parent = !is_root ? node.parent.path(): '#';
            // var id = "ajson" + ++idcount;
            var id = name;

            var type = 'default';
            var state = {};

            if (is_root) { type = 'root'};

            if (is_leaf){
                type = 'file';
                if (!node.data.status) {
                    type = 'file-error';
                }
                state = {
                    'opened' : true, 'selected' : true
                };
            }

            if (is_folder || is_root){
                if (!node.data.status) {
                    type = 'folder-error';
                }
            }

            arr.push({
                id: id,
                parent: parent,
                text: node.data.name,
                type: type,
                state: state
            });

            idmap[name] = id;
        }

        // console.log(arr);
        // console.log(arr);
        asArray(this.root);
        return arr;
    };

    this.print = function() {
        var tree = this.root;
        var depth = 0;
        var tab = "   ";

        function print(tree, depth) {

            if (tree == null || tree.length == 0) {
                console.log("%s %s --", Array(depth).join(tab), tree.data.name);
            }
            tree.childrens.forEach(function (children) {
                console.log("%s %s", Array(depth).join(tab), tree.data.name);
                print(children, depth + 1);
            });

        }

        print(tree, depth);
    };

    this.addArr = function (path_arr)  {
        path_arr.forEach(function (raw_node) {
            self.addNode(raw_node.path, raw_node.status);
        });
    };

    this.addNode = function (path, status) {
        var cur_path = path.split('/').slice(1);
        var cur_node = this.root;

        function add(cur_node, cur_path) {
            if (cur_path.length == 0) {
                return;
            }

            var has_invoked = false;

            if (cur_node.childrens) {
                cur_node.childrens.forEach(function(child_node){
                    if (child_node.data.name == cur_path[0]) {
                        add(child_node, cur_path.slice(1));
                        has_invoked = true;

                        if (status == 0 && cur_node.data.status == 1) {
                            cur_node.data.status = status;
                        }

                    }
                });
            }

            if (!has_invoked) {
                var new_node_name = cur_path[0];
                var new_node = new Node(new_node_name, cur_node, []);
                new_node.data.status = status;
                cur_node.childrens.push(new_node);

                if (status == 0 && cur_node.data.status == 1) {
                    cur_node.data.status = status;
                }

                add(new_node, cur_path.slice(1));
            }
        }

        add(cur_node, cur_path);
    };
}