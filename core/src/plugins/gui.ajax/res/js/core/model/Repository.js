/*
 * Copyright 2007-2013 Charles du Jeu - Abstrium SAS <team (at) pyd.io>
 * This file is part of Pydio.
 *
 * Pydio is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Pydio is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Pydio.  If not, see <http://www.gnu.org/licenses/>.
 *
 * The latest code can be found at <http://pyd.io/>.
 */

/** 
 * Container for a Repository.
 */
'use strict';

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError('Cannot call a class as a function'); } }

var Repository = (function () {

	/**
  * Constructor
  * @param id String
  * @param xmlDef XMLNode
  */

	function Repository(id, xmlDef) {
		_classCallCheck(this, Repository);

		this.label = '';
		this.id = id;
		this.accessType = '';
		this.nodeProviderDef = undefined;
		this.allowCrossRepositoryCopy = false;
		this.userEditable = false;
		this.slug = '';
		this.owner = '';
		this.description = '';
		if (window.ajxpResourcesFolder) {
			this.icon = window.ajxpResourcesFolder + '/images/actions/16/network-wired.png';
		}
		this.resourcesManager = new ResourcesManager();
		if (xmlDef) this.loadFromXml(xmlDef);
	}

	/**
  * @returns String
  */

	Repository.prototype.getId = function getId() {
		return this.id;
	};

	/**
  * @returns String
  */

	Repository.prototype.getLabel = function getLabel() {
		return this.label;
	};

	/**
  * @param label String
  */

	Repository.prototype.setLabel = function setLabel(label) {
		this.label = label;
	};

	Repository.prototype.getHtmlBadge = function getHtmlBadge() {
		if (!this.label) return '';
		if (!this.badge) {
			var letters = this.label.split(' ').map(function (word) {
				return word.substr(0, 1);
			}).join('');
			this.badge = '<span class=\'letter_badge\'>' + letters + '</span>';
		}
		return this.badge;
	};

	/**
  * @return String
  */

	Repository.prototype.getDescription = function getDescription() {
		return this.description;
	};

	/**
  * @returns String
  */

	Repository.prototype.getIcon = function getIcon() {
		return this.icon;
	};

	/**
  * @param icon String
  */

	Repository.prototype.setIcon = function setIcon(icon) {
		this.icon = icon;
	};

	/**
  * @return String
  */

	Repository.prototype.getOwner = function getOwner() {
		return this.owner;
	};

	/**
  * @returns String
  */

	Repository.prototype.getAccessType = function getAccessType() {
		return this.accessType;
	};

	/**
  * @param access String
  */

	Repository.prototype.setAccessType = function setAccessType(access) {
		this.accessType = access;
	};

	/**
  * Triggers ResourcesManager.load
  */

	Repository.prototype.loadResources = function loadResources() {
		this.resourcesManager.load(null, true);
	};

	/**
  * @returns Object
  */

	Repository.prototype.getNodeProviderDef = function getNodeProviderDef() {
		return this.nodeProviderDef;
	};

	/**
  * @param slug String
  */

	Repository.prototype.setSlug = function setSlug(slug) {
		this.slug = slug;
	};

	/**
  * @returns String
  */

	Repository.prototype.getSlug = function getSlug() {
		return this.slug;
	};

	Repository.prototype.getOverlay = function getOverlay() {
		return this.getOwner() ? resolveImageSource('shared.png', '/images/overlays/ICON_SIZE', 8) : '';
	};

	/**
  * Parses XML Node
  * @param repoNode XMLNode
  */

	Repository.prototype.loadFromXml = function loadFromXml(repoNode) {
		if (repoNode.getAttribute('allowCrossRepositoryCopy') && repoNode.getAttribute('allowCrossRepositoryCopy') == 'true') {
			this.allowCrossRepositoryCopy = true;
		}
		if (repoNode.getAttribute('user_editable_repository') && repoNode.getAttribute('user_editable_repository') == 'true') {
			this.userEditable = true;
		}
		if (repoNode.getAttribute('access_type')) {
			this.setAccessType(repoNode.getAttribute('access_type'));
		}
		if (repoNode.getAttribute('repositorySlug')) {
			this.setSlug(repoNode.getAttribute('repositorySlug'));
		}
		if (repoNode.getAttribute('owner')) {
			this.owner = repoNode.getAttribute('owner');
		}
		for (var i = 0; i < repoNode.childNodes.length; i++) {
			var childNode = repoNode.childNodes[i];
			if (childNode.nodeName == 'label') {
				this.setLabel(childNode.firstChild.nodeValue);
			} else if (childNode.nodeName == 'description') {
				this.description = childNode.firstChild.nodeValue;
			} else if (childNode.nodeName == 'client_settings') {
				if (childNode.getAttribute('icon_tpl_id')) {
					this.setIcon(window.ajxpServerAccessPath + '&get_action=get_user_template_logo&template_id=' + childNode.getAttribute('icon_tpl_id') + '&icon_format=small');
				} else {
					this.setIcon(childNode.getAttribute('icon'));
				}
				for (var j = 0; j < childNode.childNodes.length; j++) {
					var subCh = childNode.childNodes[j];
					if (subCh.nodeName == 'resources') {
						this.resourcesManager.loadFromXmlNode(subCh);
					} else if (subCh.nodeName == 'node_provider') {
						var nodeProviderName = subCh.getAttribute('ajxpClass');
						var nodeProviderOptions = JSON.parse(subCh.getAttribute('ajxpOptions'));
						this.nodeProviderDef = { name: nodeProviderName, options: nodeProviderOptions };
					}
				}
			}
		}
	};

	return Repository;
})();