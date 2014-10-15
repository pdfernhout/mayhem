/// <reference path="../../intern" />
import assert = require('intern/chai!assert');
import Observable = require('../../../Observable');
import registerSuite = require('intern!object');

class ExtendedObservable extends Observable {
	initializerCalled:boolean;
	_initialize():void {
		super._initialize();
		this.initializerCalled = true;
	}
}

class ObservableA extends Observable {
	_lastValue:string;
	sequence:string[];
	constructor(kwArgs?:HashMap<any>) {
		this.sequence = [];

		super(kwArgs);
		this.sequence.push('ctor a');
	}

	_initialize():void {
		super._initialize();
		this.sequence.push('init a');
		this._lastValue = 'init a';
	}
}

class ObservableB extends ObservableA {
	constructor(kwArgs?:HashMap<any>) {
		super(kwArgs);
		this.sequence.push('ctor b');
	}

	_initialize():void {
		super._initialize();
		this.sequence.push('init b');
		this._lastValue = 'init b';
	}
}

class GetSetObservable extends Observable {
	private _bar:string;

	_fooGetter():string {
		return 'foo';
	}

	_barSetter(value:string):void {
		this._bar = value + 'bar';
	}
}

registerSuite({
	name: 'mayhem/Observable',

	'construction': {
		'sets values from kwArgs'() {
			var observable = new Observable({
				foo: 'bar',
				baz: 'quux'
			});
			assert.strictEqual(observable.get('foo'), 'bar');
			assert.strictEqual(observable.get('baz'), 'quux');
		},

		'accepts no kwArgs'() {
			var observable:Observable;
			assert.doesNotThrow(function () {
				observable = new Observable();
			});
			assert.isUndefined(observable.get('foo'));
		},

		'calls initializers'() {
			var observable = new ExtendedObservable();
			assert.isTrue(observable.initializerCalled);
		}
	},

	'#_initialize'() {
		var observable = new ObservableB();

		assert.deepEqual(observable.sequence, [ 'init a', 'init b', 'ctor a', 'ctor b' ]);
		assert.deepEqual(observable._lastValue, 'init b');

		observable = new ObservableB({
			lastValue: 'kwArgs'
		});

		assert.deepEqual(observable._lastValue, 'kwArgs', 'Values from kwArgs should override initializer values');
	},

	'#get/#set': {
		'basic tests'() {
			var observable = new Observable();

			assert.isUndefined(observable.get('foo'));

			observable.set('foo', 'bar');
			assert.strictEqual(observable.get('foo'), 'bar');

			observable.set({
				foo: 'baz',
				bar: 'quux'
			});
			assert.strictEqual(observable.get('foo'), 'baz');
			assert.strictEqual(observable.get('bar'), 'quux');
		},

		'getters'() {
			var observable = new GetSetObservable();
			assert.strictEqual(observable.get('foo'), 'foo');
			observable.set('foo', 'lol');
			assert.strictEqual(observable.get('foo'), 'foo', 'Getters should be preferred over set properties');
		},

		'setters'() {
			var observable = new GetSetObservable();
			observable.set('bar', 'lol');
			assert.strictEqual(observable.get('bar'), 'lolbar');
		},

		'setters ignore constructor'() {
			var observable = new Observable({
				constructor: 'wrong'
			});
			assert.strictEqual(observable.constructor, Observable);
		}
	},

	'#observe': {
		'notifies observers when an observed property changes'() {
			var observable = new Observable({
				foo: 'bar'
			});
			var slice = Array.prototype.slice;
			var fooObservations:any[] = [];
			var bazObservations:any[] = [];
			var ignoredPropObservations:any[] = [];

			observable.observe('foo', function () {
				fooObservations.push(slice.call(arguments, 0));
			});
			observable.observe('baz', function () {
				bazObservations.push(slice.call(arguments, 0));
			});
			observable.observe('ignored-prop', function () {
				ignoredPropObservations.push(slice.call(arguments, 0));
			});

			observable.set('foo', 'FOO');
			observable.set('baz', 'BAZ');
			observable.set('foo', 'BAR');
			observable.set('baz', 'QUUX');

			assert.deepEqual(fooObservations, [
				[ 'FOO', 'bar', 'foo' ],
				[ 'BAR', 'FOO', 'foo' ]
			]);
			assert.deepEqual(bazObservations, [
				[ 'BAZ', undefined, 'baz' ],
				[ 'QUUX', 'BAZ', 'baz' ]
			]);
			assert.deepEqual(ignoredPropObservations, []);
		},

		'calls observers in Observable’s context'() {
			var observable = new Observable();
			var context:Observable;

			observable.observe('foo', function () {
				context = this;
			});
			observable.set('foo', 'bar');

			assert.strictEqual(context, observable);
		},

		'returns a handle for removing observer'() {
			var observable = new Observable();
			var count = 0;
			var handle = observable.observe('foo', function () {
				++count;
			});

			assert.strictEqual(count, 0);
			observable.set('foo', 'bar');
			assert.strictEqual(count, 1);
			observable.set('foo', 'baz');
			assert.strictEqual(count, 2);
			handle.remove();
			assert.doesNotThrow(function () {
				handle.remove();
			}, Error, 'Handle removal should be idempotent');
			observable.set('foo', 'quux');
			assert.strictEqual(count, 2);
		},

		'destruction halts observation'() {
			var observable = new Observable();
			var count = 0;
			var handle = observable.observe('foo', function () {
				++count;
			});

			assert.strictEqual(count, 0);
			observable.set('foo', 'bar');
			assert.strictEqual(count, 1);
			observable.destroy();
			assert.doesNotThrow(function () {
				observable.destroy();
			}, Error, 'Observable destruction should be idempotent');
			assert.doesNotThrow(function () {
				handle.remove();
			}, Error, 'Removing handle from destroyed observable should work but be a no-op');

			// After an observable is destroyed, behaviour becomes undefined
			try {
				observable.set('foo', 'quux');
			}
			catch (error) {}

			assert.strictEqual(count, 1);
		}
	}
});