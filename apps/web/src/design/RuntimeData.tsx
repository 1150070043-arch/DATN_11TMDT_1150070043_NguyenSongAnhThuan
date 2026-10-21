import { createContext } from 'react';
import { assetUrl } from '../lib/api';
import type { Book } from '../types';
import * as D from './Reference';
export type DesignBook = typeof D.BOOKS[number];

export const RuntimeCtx = createContext({ books: [] as Book[], add: async (_book: DesignBook, _qty?: number) => false, buy: async (_book: DesignBook, _qty?: number) => false, select: (_book: DesignBook) => {} });

export const normalize = (text?: string) => (text ?? '').toLocaleLowerCase('vi').normalize('NFC');


export function toDesign(book: Book): DesignBook {
  const reference = D.BOOKS.find(item => normalize(item.title) === normalize(book.title));
  const cached = reference && reference.isbn !== '9780061241628' ? `/design/covers/${reference.isbn}-L.jpg` : undefined;
  const cover = book.coverUrl
    ? (book.coverUrl.startsWith('https://covers.openlibrary.org/') ? cached ?? assetUrl(book.coverUrl) : assetUrl(book.coverUrl))
    : cached ?? reference?.cover ?? '';
  return { id: book.id, title: book.title ?? '', author: book.author ?? '', price: Number(book.price ?? 0), stock: book.stock ?? 0, category: (book.categoryName === 'Lịch sử - xã hội' ? 'Lịch sử - Xã hội' : book.categoryName) ?? 'Khác', description: book.description ?? '', isbn: book.isbn ?? '', cover };
}
