import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Board, BoardData, Note, BoardPreview } from '../interfaces';

@Injectable({
  providedIn: 'root'
})
export class BoardApiService {

  constructor(private http: HttpClient) { }

  /**
   * Fetches the board and adds translation language if language code is not null
   */
  public getBoard(boardId: string, targetLanguageCode: string | null): Observable<Board> {
    if (targetLanguageCode)
      return this.http.get<Board>(`api/board/?id=${boardId}&lc=${targetLanguageCode}`);
    return this.http.get<Board>(`api/board/?id=${boardId}`);
  }

  public createBoard(boardTitle: string): Observable<Board> {
    return this.http.post<Board>('api/board/', { title: boardTitle });
  }

  public updateBoard(data: BoardData): Observable<void> {
    return this.http.post<void>('api/edit-board/', data);
  }

  /**
   * Returns a list of previews of boards available to user
   */
  public myBoardsList(): Observable<BoardPreview[]> {
    return this.http.get<BoardPreview[]>('api/myboards/');
  }
}
