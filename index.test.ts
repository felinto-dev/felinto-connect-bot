import { newPage } from './index';
import {expect, test} from '@jest/globals';

test('check', () => {
	expect(typeof newPage).toBe('function');
})