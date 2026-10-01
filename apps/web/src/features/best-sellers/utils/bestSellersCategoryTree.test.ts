import { type BestSellersCategoryDto } from '@repo/shared';
import { describe, expect, it } from 'vitest';

import { EMPTY_CATEGORY_BUCKET, activeChain, flattenCategoryTree, mergeCategoryAnswer } from './bestSellersCategoryTree';

const entry = (name: string, path: string | null, extra: Partial<BestSellersCategoryDto> = {}): BestSellersCategoryDto => ({
  name,
  path,
  link: null,
  isSelected: false,
  isRoot: false,
  ...extra,
});

const anyDepartment = entry('Any Department', null, { isRoot: true });

const rootAnswer = [anyDepartment, entry('Electronics', 'electronics'), entry('Toys & Games', 'toys-and-games')];

const electronicsAnswer = [
  anyDepartment,
  entry('Electronics', null, { isSelected: true }),
  entry('Headphones', 'electronics/172541'),
  entry('Camera & Photo', 'electronics/502394'),
];

const headphonesAnswer = [
  anyDepartment,
  entry('Electronics', 'electronics'),
  entry('Headphones', null, { isSelected: true }),
  entry('Earbud Headphones', 'electronics/12097479011'),
  entry('Over-Ear Headphones', 'electronics/12097480011'),
];

const everyoneExpanded = () => true;
const names = (rows: ReturnType<typeof flattenCategoryTree>) => rows.map((r) => `${r.depth}:${r.name}`);

describe('mergeCategoryAnswer', () => {
  it('reads the root answer as the departments', () => {
    const bucket = mergeCategoryAnswer(EMPTY_CATEGORY_BUCKET, '', rootAnswer);
    expect(bucket.rootChildren).toEqual(['electronics', 'toys-and-games']);
    expect(bucket.nodes.electronics).toEqual({ name: 'Electronics', parent: null, children: undefined });
  });

  it('reads a department answer as that department with its children', () => {
    const bucket = mergeCategoryAnswer(mergeCategoryAnswer(EMPTY_CATEGORY_BUCKET, '', rootAnswer), 'electronics', electronicsAnswer);
    expect(bucket.nodes.electronics.children).toEqual(['electronics/172541', 'electronics/502394']);
    expect(bucket.nodes['electronics/172541']).toEqual({ name: 'Headphones', parent: 'electronics', children: undefined });
  });

  it('keeps the pressed sub-category and its siblings when it has sub-categories of its own', () => {
    let bucket = mergeCategoryAnswer(EMPTY_CATEGORY_BUCKET, '', rootAnswer);
    bucket = mergeCategoryAnswer(bucket, 'electronics', electronicsAnswer);
    bucket = mergeCategoryAnswer(bucket, 'electronics/172541', headphonesAnswer);

    // The department still lists Headphones AND Camera & Photo …
    expect(bucket.nodes.electronics.children).toEqual(['electronics/172541', 'electronics/502394']);
    // … and Headphones now owns the two new children.
    expect(bucket.nodes['electronics/172541'].children).toEqual(['electronics/12097479011', 'electronics/12097480011']);
    expect(bucket.nodes['electronics/12097479011'].parent).toBe('electronics/172541');
  });

  it('ignores an answer with no tree or no selected entry', () => {
    expect(mergeCategoryAnswer(EMPTY_CATEGORY_BUCKET, 'electronics', [])).toBe(EMPTY_CATEGORY_BUCKET);
    expect(mergeCategoryAnswer(EMPTY_CATEGORY_BUCKET, 'electronics', [anyDepartment])).toBe(EMPTY_CATEGORY_BUCKET);
  });

  it('falls back to the alias department as the parent when no chain is printed', () => {
    const bucket = mergeCategoryAnswer(EMPTY_CATEGORY_BUCKET, 'electronics/172541', [
      entry('Headphones', null, { isSelected: true }),
      entry('Earbud Headphones', 'electronics/12097479011'),
    ]);
    expect(bucket.nodes['electronics/172541'].parent).toBe('electronics');
  });
});

describe('activeChain', () => {
  it('lists the node and its ancestors top-down, and nothing at the root', () => {
    let bucket = mergeCategoryAnswer(EMPTY_CATEGORY_BUCKET, '', rootAnswer);
    bucket = mergeCategoryAnswer(bucket, 'electronics/172541', headphonesAnswer);
    expect(activeChain(bucket, 'electronics/172541')).toEqual(['electronics', 'electronics/172541']);
    expect(activeChain(bucket, '')).toEqual([]);
  });
});

describe('flattenCategoryTree', () => {
  it('shows the pressed category in place, selected, between its parent and its children', () => {
    let bucket = mergeCategoryAnswer(EMPTY_CATEGORY_BUCKET, '', rootAnswer);
    bucket = mergeCategoryAnswer(bucket, 'electronics', electronicsAnswer);
    bucket = mergeCategoryAnswer(bucket, 'electronics/172541', headphonesAnswer);
    const category = 'electronics/172541';
    const chain = new Set(activeChain(bucket, category));

    const rows = flattenCategoryTree({ bucket, category, isExpanded: (path) => chain.has(path), query: '' });

    expect(names(rows)).toEqual([
      '0:Electronics',
      '1:Headphones',
      '2:Earbud Headphones',
      '2:Over-Ear Headphones',
      '1:Camera & Photo',
      '0:Toys & Games',
    ]);
    expect(rows.find((r) => r.isActive)?.name).toBe('Headphones');
    expect(rows.find((r) => r.isActiveBranch)?.name).toBe('Electronics');
  });

  it('shows the chain of a deep link before the intermediate levels were ever visited', () => {
    const bucket = mergeCategoryAnswer(EMPTY_CATEGORY_BUCKET, 'electronics/172541', headphonesAnswer);
    const rows = flattenCategoryTree({ bucket, category: 'electronics/172541', isExpanded: everyoneExpanded, query: '' });
    expect(names(rows)).toEqual(['0:Electronics', '1:Headphones', '2:Earbud Headphones', '2:Over-Ear Headphones']);
  });

  it('collapses a node but keeps its own row', () => {
    const bucket = mergeCategoryAnswer(mergeCategoryAnswer(EMPTY_CATEGORY_BUCKET, '', rootAnswer), 'electronics', electronicsAnswer);
    const rows = flattenCategoryTree({ bucket, category: 'electronics', isExpanded: () => false, query: '' });
    expect(names(rows)).toEqual(['0:Electronics', '0:Toys & Games']);
    expect(rows[0].hasChildren).toBe(true);
  });

  it('marks a visited node with no children as a leaf and an unvisited one as expandable', () => {
    let bucket = mergeCategoryAnswer(EMPTY_CATEGORY_BUCKET, '', rootAnswer);
    bucket = mergeCategoryAnswer(bucket, 'electronics', [anyDepartment, entry('Electronics', null, { isSelected: true })]);
    const rows = flattenCategoryTree({ bucket, category: 'electronics', isExpanded: everyoneExpanded, query: '' });
    expect(rows.find((r) => r.name === 'Electronics')?.hasChildren).toBe(false);
    expect(rows.find((r) => r.name === 'Toys & Games')?.hasChildren).toBe(true);
  });

  it('searches every known node by name, flat', () => {
    let bucket = mergeCategoryAnswer(EMPTY_CATEGORY_BUCKET, '', rootAnswer);
    bucket = mergeCategoryAnswer(bucket, 'electronics/172541', headphonesAnswer);
    const rows = flattenCategoryTree({ bucket, category: '', isExpanded: everyoneExpanded, query: 'headphone' });
    expect(names(rows).sort()).toEqual(['0:Earbud Headphones', '0:Headphones', '0:Over-Ear Headphones']);
  });
});
