import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { Board, Note, User } from '../interfaces';

@Injectable({
  providedIn: 'root'
})
export class ApiService {

  constructor() { }

  public getBoard(boardKey: string): Observable<Board> {
    const notes: Note[] = [];
    notes.push({
      key: 'key1',
      content: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Quisque porta odio ut magna finibus scelerisque vel malesuada mi.',
      image: null,
      creationDate: new Date().toISOString(),
      creator: 'user@google.com',
      color: '#ffff99',
      boardKey: 'boardKey',
      x: 200,
      y: 0,
    });
    notes.push({
      key: 'key2',
      content: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Quisque porta odio ut magna finibus scelerisque vel malesuada mi.',
      image: null,
      creationDate: new Date().toISOString(),
      creator: 'user2@google.com',
      color: '#ccfff5',
      boardKey: 'boardKey',
      x: 400,
      y: 500,
    });
    notes.push({
      key: 'key3',
      content: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Quisque porta odio ut magna finibus scelerisque vel malesuada mi.',
      image: null,
      creationDate: new Date().toISOString(),
      creator: 'user3@google.com',
      color: '#ffe6ff',
      boardKey: 'boardKey',
      x: 600,
      y: 0,
    });
    notes.push({
      key: 'key4',
      content: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Quisque porta odio ut magna finibus scelerisque vel malesuada mi.',
      image: null,
      creationDate: new Date().toISOString(),
      creator: 'user3@google.com',
      color: '#e6e6ff',
      boardKey: 'boardKey',
      x: 600,
      y: 500,
    });

    const creator: User = {
      key: 'userKey',
      nickname: 'Googler',
      accessibleBoards: [],
      email: 'user@google.com'
    };

    const board: Board = {
      key: boardKey,
      notes: notes,
      title: 'Board title',
      rows: 5,
      cols: 8,
      creator: creator,
      users: [],
      backgroundImg: null,
      creationDate: new Date(),
    };

    creator.accessibleBoards.push(board);
    return of(board);
  }
}
