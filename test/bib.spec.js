/* eslint-env node, mocha */
'use strict';

const assert = require('chai').assert;
const fetchMock = require('fetch-mock');
const sinon = require('sinon');

const ZoteroBib = require('../src/js/main.js');
const zoteroItemBook = require('./fixtures/zotero-item-book');
const zoteroItemPaper = require('./fixtures/zotero-item-paper');
const zoteroItemNote = require('./fixtures/zotero-item-note');
const cslItemBook = require('./fixtures/csl-item-book');
const searchFixture = require('./fixtures/search');

(global || window).CSL = require('citeproc');

class FakeStore {
	constructor() { this.clear(); }
	getItem(key) { return key in this.storage && this.storage[key] || null }
	setItem(key, value) { this.storage[key] = value }
	clear() { this.storage = {} }
}

describe('Zotero Bib', () => {
	var fakeStore,
		fetchRequests;

	afterEach(fetchMock.restore);

	beforeEach(() => {
		fakeStore = new FakeStore();
		fetchRequests = [];

		let headersOK = {
			'Content-Type': 'application/json'
		};

		let headersBAD = {
			'Content-Type': 'text/plain'
		};

		fetchMock.mock('/search', (url, opts) => {
			fetchRequests.push({ url, opts });
			return {
				body: [zoteroItemPaper],
				headers: headersOK
			};
		});

		fetchMock.mock('/web', (url, opts) => {
			fetchRequests.push({ url, opts });

			try {
				const body = JSON.parse(opts.body);
				if(body.url.includes('book')) {
					return {
						body: [zoteroItemBook],
						headers: headersOK
					}
				} else if(body.url.includes('paper')) {
					return {
						body: [zoteroItemPaper],
						headers: headersOK
					}
				} else if(body.url.includes('multi')) {
					return {
						body: [zoteroItemBook, zoteroItemPaper],
						headers: headersOK
					}
				} else if(body.url.includes('note')) {
					return {
						body: [zoteroItemPaper, zoteroItemNote],
						headers: headersOK
					}
				} else if(body.url.includes('choice')) {
					if('items' in body && Object.keys(searchFixture).includes(Object.keys(body.items)[0])) {
						return {
							body: [zoteroItemBook],
							headers: headersOK
						}
					} else {
						return {
							status: 300,
							body: searchFixture,
							headers: headersOK
						}
					}
				} else {
					return {
						status: 501,
						headers: headersBAD
					}
				}
			} catch(_) {
				return {
					status: 400,
					headers: headersBAD
				}
			}
		});
	});


	it('should convert (Zotero -> CSL) initial items', () => {
		let bib = new ZoteroBib({
			persist: false,
			initialItems: [zoteroItemBook]
		});
		assert.equal(bib.itemsCSL.length, 1);
		assert.deepInclude(bib.itemsCSL[0], cslItemBook);
	});

	it('should convert (Zotero -> CSL) manually added items', () => {
		let bib = new ZoteroBib({
			persist: false
		});
		assert.equal(bib.items.length, 0);
		bib.addItem(zoteroItemBook);
		assert.equal(bib.itemsCSL.length, 1);
		assert.deepInclude(bib.itemsCSL[0], cslItemBook);
	});

	it('should remove items', () => {
		let bib = new ZoteroBib({
			persist: false,
			initialItems: [zoteroItemBook]
		});

		assert.equal(bib.itemsCSL.length, 1);
		bib.removeItem({}); //make sure it removes the right item
		assert.equal(bib.itemsCSL.length, 1);
		bib.removeItem(bib.itemsRaw[0]);
		assert.equal(bib.itemsCSL.length, 0);
	});

	it('should update an item', () => {
		let bib = new ZoteroBib({
			persist: false,
			initialItems: [zoteroItemBook]
		});

		assert.equal(bib.items[0].title, 'Dune');
		bib.updateItem(0, {
			...bib.items[0],
			title: 'FooBar'
		});
		assert.equal(bib.items[0].title, 'FooBar');
	});

	it('should clear items', () => {
		let bib = new ZoteroBib({
			persist: false,
			initialItems: [zoteroItemBook, zoteroItemPaper]
		});
		assert.equal(bib.itemsCSL.length, 2);
		bib.clearItems();
		assert.equal(bib.itemsCSL.length, 0);
	});

	it('should persist initial items in localStorage', () => {
		assert.equal('zotero-bib-items' in fakeStore.storage, false);

		new ZoteroBib({
			storage: fakeStore,
			persist: true,
			initialItems: [zoteroItemBook]
		});

		assert.equal('zotero-bib-items' in fakeStore.storage, true);
		assert.equal(JSON.parse(fakeStore.storage['zotero-bib-items']).length, 1);
		assert.deepInclude(JSON.parse(fakeStore.storage['zotero-bib-items'])[0], zoteroItemBook);
	});

	it('should load initial items from localStorage without overriding initial items', () => {
		fakeStore.storage['zotero-bib-items'] = JSON.stringify([zoteroItemPaper]);

		new ZoteroBib({
			storage: fakeStore,
			persist: true,
			initialItems: [zoteroItemBook]
		});

		assert.equal(JSON.parse(fakeStore.storage['zotero-bib-items']).length, 2);
	});

	it('should load initial items from localStorage overriding initial items if override preference is set', () => {
		fakeStore.storage['zotero-bib-items'] = JSON.stringify([zoteroItemPaper]);

		new ZoteroBib({
			storage: fakeStore,
			persist: true,
			override: true,
			initialItems: [zoteroItemBook]
		});

		assert.equal(JSON.parse(fakeStore.storage['zotero-bib-items']).length, 1);
		assert.deepInclude(JSON.parse(fakeStore.storage['zotero-bib-items'])[0], zoteroItemBook);
	});

	it('should persist manually added items in localStorage', () => {
		assert.equal('zotero-bib-items' in fakeStore.storage, false);

		let bib = new ZoteroBib({
			storage: fakeStore,
			persist: true
		});

		assert.equal(JSON.parse(fakeStore.storage['zotero-bib-items']).length, 0);
		bib.addItem(zoteroItemBook);
		assert.equal(JSON.parse(fakeStore.storage['zotero-bib-items']).length, 1);
		assert.deepInclude(JSON.parse(fakeStore.storage['zotero-bib-items'])[0], zoteroItemBook);
	});

	it('should persist remove items from localStorage', () => {
		assert.equal('zotero-bib-items' in fakeStore, false);

		let bib = new ZoteroBib({
			storage: fakeStore,
			persist: true,
			initialItems: [zoteroItemBook]
		});

		assert.equal(JSON.parse(fakeStore.storage['zotero-bib-items']).length, 1);
		bib.removeItem(bib.itemsRaw[0]);
		assert.equal(JSON.parse(fakeStore.storage['zotero-bib-items']).length, 0);
	});

	it('should persist item changes in localStorage ', () => {
		let bib = new ZoteroBib({
			storage: fakeStore,
			persist: true,
			initialItems: [zoteroItemBook]
		});

		assert.equal(JSON.parse(fakeStore.storage['zotero-bib-items'])[0].title, 'Dune');
		bib.updateItem(0, {
			...bib.items[0],
			title: 'FooBar'
		});
		assert.equal(JSON.parse(fakeStore.storage['zotero-bib-items'])[0].title, 'FooBar');
	});

	it('should clear items from localStorage', () => {
		assert.equal('zotero-bib-items' in fakeStore.storage, false);

		let bib = new ZoteroBib({
			storage: fakeStore,
			persist: true,
			initialItems: [zoteroItemBook, zoteroItemPaper]
		});
		assert.equal(JSON.parse(fakeStore.storage['zotero-bib-items']).length, 2);
		bib.clearItems();
		assert.equal(JSON.parse(fakeStore.storage['zotero-bib-items']).length, 0);
	});

	it('should storagePrefix preference', () => {
		assert.equal('zotero-bib-items' in fakeStore.storage, false);
		assert.equal('foo-items' in fakeStore.storage, false);
		assert.equal('items' in fakeStore.storage, false);

		new ZoteroBib({
			storage: fakeStore,
			persist: true,
			initialItems: [zoteroItemBook],
			storagePrefix: 'foo'
		});

		assert.equal('zotero-bib-items' in fakeStore.storage, false);
		assert.equal('foo-items' in fakeStore.storage, true);
		assert.equal('items' in fakeStore.storage, false);
	});

	it('should translate an url using translation server', async () => {
		let bib = new ZoteroBib({
			persist: false
		});

		const translationResult = await bib.translateUrl('http://example.com/multi');
		assert.equal(fetchRequests.length, 1);
		assert.equal(translationResult.items[0].key, zoteroItemBook.key);
		assert.equal(translationResult.items[1].key, zoteroItemPaper.key);
	});

	it('should translate an identifier using translation server', async () => {
		let bib = new ZoteroBib({
			persist: false
		});

		const translationResult = await bib.translateIdentifier('123');
		assert.equal(fetchRequests.length, 1);
		assert.equal(translationResult.items[0].key, zoteroItemPaper.key);
	});

	it('should add a translated item', async () => {
		let bib = new ZoteroBib({
			persist: false
		});

		assert.equal(bib.items.length, 0);
		await bib.translateUrl('http://example.com/paper');
		assert.equal(bib.items.length, 1);
		assert.equal(bib.items[0].key, zoteroItemPaper.key);
	});

	it('should not add a translated item if second parameter is false', async () => {
		let bib = new ZoteroBib({
			persist: false
		});

		assert.equal(bib.items.length, 0);
		await bib.translateUrl('http://example.com/paper', false);
		assert.equal(bib.items.length, 0);
	});

	it('should add a translated item together with a note', async () => {
		let bib = new ZoteroBib({
			persist: false
		});

		assert.equal(bib.items.length, 0);
		await bib.translateUrl('http://example.com/note');
		assert.equal(bib.items.length, 2);
		assert.equal(bib.items[0].key, zoteroItemPaper.key);
	});

	it('should add an item picked from multiple items page', async () => {
		let bib = new ZoteroBib({
			persist: false
		});

		assert.equal(bib.items.length, 0);
		const translationResult = await bib.translateUrl('http://example.com/choice');
		assert.equal(bib.items.length, 0);

		const itemKey = Object.keys(translationResult.items)[0];
		const itemValue = translationResult.items[itemKey];

		await bib.translateUrlItems(
			'http://example.com/choice',
			{ [itemKey]: itemValue }
		);

		assert.equal(bib.items.length, 1);
		assert.equal(bib.items[0].key, zoteroItemBook.key);
	});

	it('should shouldn\'t add an untranslatable item', async () => {
		let bib = new ZoteroBib({
			persist: false
		});

		assert.equal(bib.itemsCSL.length, 0);
		try {
			await bib.translateUrl('http://example.com/');
		} catch(_) {
			// ignore
		}
		assert.equal(bib.itemsCSL.length, 0);
	});

	it('should replace CURRENT_TIMESTAMP with actual timestamp on translation', async () => {
		let bib = new ZoteroBib({
			persist: false
		});
		let clock = sinon.useFakeTimers(new Date(Date.UTC(2017,4,10,11,12,13)));
		await bib.translateUrl('http://example.com/paper');
		assert.equal(bib.itemsRaw[0].accessDate, '2017-05-10 11:12:13');
		clock.restore();
	});

	it('should accept translationServerUrl and translationServerPrefix', async () => {
		fetchMock.mock('https://example.com/lorem/ipsum/web', zoteroItemBook);

		let bib = new ZoteroBib({
			persist: false,
			translationServerUrl: 'https://example.com',
			translationServerPrefix: 'lorem/ipsum/'
		});

		await bib.translateUrl('http://example.com/paper');
	});

	it('should export items', async () => {
		fetchMock.mock('https://example.com/export?format=ris', (url, opts) => {
			assert.equal(opts.headers['Content-Type'], 'application/json');
			return {
				headers: {
					'Content-Type': 'plain/text'
				},
				body: 'RESULT'
			}
		});

		const bib = new ZoteroBib({
			persist: false,
			translationServerUrl: 'https://example.com'
		});

		bib.addItem(zoteroItemBook);
		let result = await bib.exportItems('ris');
		assert.equal(result, 'RESULT');
	});

	it('should filter out items that cannot be exported', async () => {
		fetchMock.mock('https://example.com/export?format=ris', (url, opts) => {
			assert.equal(opts.headers['Content-Type'], 'application/json');
			assert.equal(JSON.parse(opts.body).length, 1);
			return {
				headers: {
					'Content-Type': 'plain/text'
				},
				body: 'RESULT'
			}
		});

		const bib = new ZoteroBib({
			persist: false,
			translationServerUrl: 'https://example.com'
		});

		bib.addItem(zoteroItemBook);
		bib.addItem(zoteroItemNote);
		let result = await bib.exportItems('ris');
		assert.equal(result, 'RESULT');
	});

	it('should throw an error when invalid storage engine is provided', () => {
		assert.throws(() => {
			new ZoteroBib({
				persist: true,
				storage: {}
			});
		});
	});
});
