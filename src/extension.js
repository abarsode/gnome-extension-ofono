 /*
  * Copyright (C) 2011 Intel Corporation. All rights reserved.
  *
  * This program is free software: you can redistribute it and/or modify
  * it under the terms of the GNU General Public License as published by
  * the Free Software Foundation, either version 3 of the License, or
  * (at your option) any later version.
  *
  * This program is distributed in the hope that it will be useful,
  * but WITHOUT ANY WARRANTY; without even the implied warranty of
  * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  * GNU General Public License for more details.
  *
  * You should have received a copy of the GNU General Public License
  * along with this program.  If not, see <http://www.gnu.org/licenses/>.
  */

const St = imports.gi.St;
const Mainloop = imports.mainloop;
const Main = imports.ui.main;
const Lang = imports.lang;
const Gio = imports.gi.Gio;
const PopupMenu = imports.ui.popupMenu;
const PanelMenu = imports.ui.panelMenu;
const Gettext = imports.gettext;
const Clutter = imports.gi.Clutter;
const DBus = imports.dbus;

const _ = Gettext.gettext;

const TechnologyIface = {
    name: 'net.connman.Technology',
    methods: [
        { name: 'GetProperties', inSignature: '', outSignature: 'a{sv}' },
        { name: 'SetProperty', inSignature: 'sv', outSignature: '' },
        { name: 'Scan', inSignature: '', outSignature: '' }
    ],
    signals: [
        { name: 'PropertyChanged', inSignature: '{sv}' }
    ]
};

function Technology() {
    this._init.apply(this, arguments);
}

Technology.prototype = {
    _init: function(path, mgr) {
        DBus.system.proxifyObject(this, 'net.connman', path);
	this.path = path;

	this.GetPropertiesRemote(Lang.bind(this,
            function(result, excp) {
		this.tech_switch = new PopupMenu.PopupSwitchMenuItem(result['Name'], result['Powered']);
		this.tech_switch.connect("toggled", Lang.bind(this, this.switch_toggle));
		mgr.mgr_menu.addMenuItem(this.tech_switch);
	    }));

	this.connect('PropertyChanged', Lang.bind(this, function(sender, str, val) {
		    if (str == "Powered")
			this.tech_switch.setToggleState(val);
	}));
    },

    destroy: function() {
	this.tech_switch.destroy();
	this.tech_switch = null;
	this.path = null;
    },

    switch_toggle: function(item, value) {
	this.SetPropertyRemote("Powered", value);
    },

    get_path: function() {
	return this.path;
    },

};

DBus.proxifyPrototype(Technology.prototype, TechnologyIface);

const ManagerIface = {
    name: 'net.connman.Manager',
    methods: [
        { name: 'GetProperties', inSignature: '', outSignature: 'a{sv}' },
        { name: 'SetProperty', inSignature: 'sv', outSignature: '' },
        { name: 'GetTechnologies', inSignature: '', outSignature: 'a(oa{sv})' }
    ],
    signals: [
        { name: 'PropertyChanged', inSignature: '{sv}' },
        { name: 'TechnologyAdded', inSignature: 'oa{sv}' },
        { name: 'TechnologyRemoved', inSignature: 'o' }
    ]
};

function Manager() {
    this._init.apply(this, arguments);
}

Manager.prototype = {
    tech:[],

    _init: function(connmgr) {
        DBus.system.proxifyObject(this, 'net.connman', '/');

	this.mgr_menu = new PopupMenu.PopupMenuSection();
	connmgr.menu.addMenuItem(this.mgr_menu);

	this.GetPropertiesRemote(Lang.bind(this,
            function(result, excp) {
		if (!excp)
		    this.create_offline(result['OfflineMode']);
	}));

	this.GetTechnologiesRemote(Lang.bind(this,
            function(result, excp) {
		for each (var tech in result) {
		    for each (var item in tech) {
			if(typeof(item) == 'string')
			    this.create_technology(item);
		    };
		};
	}));

	this.connect('TechnologyAdded', Lang.bind(this, function(sender, path, properties) {
		this.create_technology(path);
	}));

	this.connect('TechnologyRemoved', Lang.bind(this, function(sender, path) {
		this.remove_technology(path);
	}));

    },

    destroy: function() {
	while(1) {
	    let obj = this.tech.pop();
	    if (obj == null)
		break;
	    obj.destroy();
	};

	this.tech = -1;
	this.offline_switch.destroy();
	this.offline_switch = null;
	this.mgr_menu.destroy();
	this.mgr_menu = null;
    },

    create_offline: function(offline) {
        this.offline_switch = new PopupMenu.PopupSwitchMenuItem("Offlinemode", offline);
        this.offline_switch.connect("toggled", Lang.bind(this, this.offline_toggle));

	this.mgr_menu.addMenuItem(this.offline_switch);

	this.connect('PropertyChanged', Lang.bind(this, function(sender, property, value) {
	    if (property == "OfflineMode") {
		this.offline_switch.setToggleState(value);
	    };
	}));
    },

    offline_toggle: function(item, value) {
	this.SetPropertyRemote("OfflineMode", value);
    },

    create_technology: function(path) {
	let index = this.get_tech_index(path);
	if (index != -1)
	    return;

	let obj = new Technology(path, this);
	this.tech.push(obj);
    },

    remove_technology: function(path) {
	let index = this.get_tech_index(path);
	if (index == -1)
	    return;

	let obj = this.tech[index];
	obj.destroy();
	this.tech[index] = null;
	this.tech.splice(index, 1);
    },

    get_tech_index: function(path) {
	for (var i = 0; i < this.tech.length; i++) {
	    var obj = this.tech[i];
	    if (obj.get_path() == path)
		return i;
	}
	return -1;
    },
};

DBus.proxifyPrototype(Manager.prototype, ManagerIface);

function ConnManager(metadata) {
    this._init(metadata);
}

ConnManager.prototype = {
    __proto__: PanelMenu.Button.prototype,

    run: false,

    _init: function(metadata) {
        PanelMenu.Button.prototype._init.call(this, 0.0);
        this.build_ui();
        DBus.system.watch_name('net.connman', null,
			   Lang.bind(this, this.ConnmanAppeared),
			   Lang.bind(this, this.ConnmanVanished)
        );
    },

    build_ui: function() {
        this.icon = new St.Icon({
            icon_type: St.IconType.SYMBOLIC,
            style_class: "popup-menu-icon",
            icon_name: "network-offline"
        });

        this.main_icon = new St.BoxLayout();
        this.main_icon.add_actor(this.icon);

        this.actor.add_actor(this.main_icon);
	this.ConnmanVanished();
    },

    ConnmanAppeared: function() {
	if (this._mainmenu)
	    this._mainmenu.destroy();

	this.manager = new Manager(this)
    },

    ConnmanVanished: function() {
	if (this.manager) {
	    this.manager.destroy();
	    this.manager = null;
	}

	this._mainmenu = new PopupMenu.PopupMenuSection();
	let no_connmand = new PopupMenu.PopupMenuItem(_("Connman is not running"), { reactive: false, style_class: "section-title" });
	this._mainmenu.addMenuItem(no_connmand);

	this.menu.addMenuItem(this._mainmenu);
    },

    enable: function() {
        this.run = true;
        Main.panel._rightBox.insert_actor(this.actor, 0);
        Main.panel._menus.addMenu(this.menu);
    },

    disable: function() {
        this.run = false;
        Main.panel._rightBox.remove_actor(this.actor);
        Main.panel._menus.removeMenu(this.menu);
    },
}

function init(metadata) {
    global.log ('running ConnManager extension');
    return new ConnManager(metadata);
}
