/* eslint-env node */
'use strict';

const assert = require('chai').assert;
const strToDate = require('../src/js/zotero-shim/str-to-date');
const itemToCSLJSON = require('../src/js/zotero-shim/item-to-csl-json');
const zoteroItemBook = require('./fixtures/zotero-item-book');
const zoteroItemPaper = require('./fixtures/zotero-item-paper');
const cslItemBook = require('./fixtures/csl-item-book');
const cslItemPaper = require('./fixtures/csl-item-paper');

describe('Zotero Shim', () => {
	it('should convert date to CSL format', () => {
		assert.include(strToDate('22 feb 1955'),
			{ year: '1955', month: 1, day: 22 }
		);
		assert.include(strToDate('1st of may 1215'),
			{ year: '1215', month: 4, day: 1 }
		);
		assert.include(strToDate('today'), {
				year: (new Date()).getFullYear().toString(),
				month: (new Date()).getMonth(),
				day: (new Date()).getDate()
			}
		);
	});

	it('should convert Zotero Item format to CSL format', () => {
		assert.deepInclude(itemToCSLJSON(zoteroItemBook), cslItemBook);
		assert.deepInclude(itemToCSLJSON(zoteroItemPaper), cslItemPaper);
	});
});
