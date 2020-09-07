import { Component, OnInit, Output, EventEmitter, Input, OnDestroy } from '@angular/core';
import { CdkDragEnd, CdkDragStart } from '@angular/cdk/drag-drop';
import { Vector2 } from '../utility/vector';
import { getTranslateValues } from '../utility/util';
import { Note, Board, BoardData, NoteUpdateRequest } from '../interfaces';
import { NewNoteComponent } from '../new-note/new-note.component';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute } from '@angular/router';
import { NotesApiService } from '../services/notes-api.service';
import { State } from '../enums/state.enum';
import { BoardApiService } from '../services/board-api.service';
import { TranslateService } from '../services/translate.service';
import _ from 'lodash';
import { MatSnackBar } from '@angular/material/snack-bar';

@Component({
  selector: 'app-board',
  templateUrl: './board.component.html',
  styleUrls: ['./board.component.css']
})
export class BoardComponent implements OnInit, OnDestroy {

  @Output() boardLoaded = new EventEmitter<BoardData>(true);

  /**
   * Used by board-container component to pass updated board data
   */
  @Input()
  set boardUpdatedData(data: BoardData) {
    if (data) {
      // received a new data, update board object fields
      this.board.title = data.title;
      this.board.cols = data.cols;
      this.board.rows = data.rows;
      // update abstract grid
      this.boardGrid = null;
      this.updateBoardAbstractGrid();
    }
  }

  /**
   * Input used to set target language of notes and translate notes
   */
  @Input()
  set notesLanguage(notesTargetLanguage: string) {
    // do translation here
    if (notesTargetLanguage && this.board.notes) {
      this.notesTargetLanguage = notesTargetLanguage;
      const texts = [];
      this.board.notes.forEach(note => {
        texts.push(note.content);
      });
      // do a request to translate api
      this.translateService.translateArray(texts, notesTargetLanguage).subscribe(data => {
        for (let i = 0; i < this.board.notes.length; ++i) {
          const note = this.board.notes[i];
          // create mapping from note to translated text
          this.notesTranslation[note.id] = data.result[i];
        }
      });
    }
  }

  // hashtable which has translation for every note
  // note.id mapped to note translation
  private notesTranslation = {};
  // another hashtable that stores the original version of notes content
  private notesOriginalContent = {}
  private notesTargetLanguage = null;
  private boardGrid: number[][];
  public board: Board;
  public readonly NOTE_WIDTH = 200;
  public readonly NOTE_HEIGHT = 250;
  private intervalFun: any = null;

  constructor(private boardApiService: BoardApiService,
    private dialog: MatDialog,
    private activatedRoute: ActivatedRoute,
    private notesApiService: NotesApiService,
    private translateService: TranslateService,
    private snackBar: MatSnackBar) {
  }

  // destroys setInterval
  ngOnDestroy(): void {
    clearInterval(this.intervalFun);
  }

  ngOnInit(): void {
    // load board
    this.activatedRoute.paramMap.subscribe(params => {
      const boardId = params.get('id'); // get board id from route param
      // load board with the key
      this.fetchBoardData(boardId);
      // fetch updates data each 2 seconds from the server
      this.intervalFun = setInterval(() => {
        this.fetchUpdate();
      }, 2000);
    });
  }

  /**
   * Fetches the board data from the server.
   * Initializes local variable board, sends data to the sidenav,
   * updates abstract grid
   */
  private fetchBoardData(boardId: string) {
    // load board with the key
    this.boardApiService.getBoard(boardId).subscribe(board => {
      this.board = _.merge(this.board, board);
      this.updateBoardAbstractGrid();
      // pass essential board's data to the sidenav
      this.emitDataToSidenav(board);
      // create hashtable of notes content in original language
      this.updateOriginalNotesContentMap(board);
    });
  }

  /**
   * Fetches an updated content of notes and board from the server
   */
  private fetchUpdate() {
    if (this.board) {
      // generate notes update request
      const notesTimestamps: NoteUpdateRequest[] = [];
      this.board.notes.forEach(note => {
        notesTimestamps.push({ id: note.id, lastUpdated: this.getNoteLastUpdated(note)});
      });
      // send a request
      this.notesApiService.getUpdatedNotes(notesTimestamps, this.board.id).subscribe((response) => {
        
        const newNotes = response.updatedNotes;
        const removedNotes = response.removedNotes;
        const notesWithUpdatedContent = [];

        // server returns array of notes that have been remove, this notes have to be removed also here
        removedNotes.forEach(id => {
          const index = this.board.notes.findIndex((note) => id === +note.id);
          if(index >= 0 && index < this.board.notes.length){
            this.board.notes.splice(index, 1);
          }
        });
        // server returns array of notes that have been changed, find local copy of that notes and update them
        // merge notes
        const ids = new Set(this.board.notes.map(n => n.id));
        this.board.notes = [...this.board.notes, ...newNotes.filter(n => !ids.has(n.id))];
        // update map of original notes texts
        this.updateOriginalNotesContentMap(this.board);
        // update abstract grid
        this.updateBoardAbstractGrid();
        for (const newNote of newNotes) {
          // if content of the existing note was updated and translation is enabled, add notes content to translation array
          if (this.notesTargetLanguage && newNote.content !== this.notesOriginalContent[newNote.id]) {
            notesWithUpdatedContent.push(newNote);
          }
        }
        // if any notes must be translated, execute translation
        if (notesWithUpdatedContent.length) {
          const snackbarRef = this.snackBar.open("Translating new notes ...", "Ok");
          const textsToTranslate = [];
          notesWithUpdatedContent.forEach(note => {
            textsToTranslate.push(note.content);
          });
          // send array of note content to the translate api and update local translation hashtable
          this.translateService.translateArray(textsToTranslate, this.notesTargetLanguage).subscribe(data => {
            for (let i = 0; i < notesWithUpdatedContent.length; ++i) {
              const note = notesWithUpdatedContent[i];
              this.notesTranslation[note.id] = data.result[i];
            }
            // close dialgo saying that notes are being translated after translation is completed
            snackbarRef.dismiss();
          });
        }
      });

      // pull board updates
      const boardRequestData = {id: this.board.id, lastUpdated: this.boardLastUpdated};
      this.boardApiService.getUpdatedBoard(boardRequestData).subscribe(newBoard => {
        // if there is an update
        if (newBoard) {
          this.board.backgroundImg = newBoard.backgroundImg;
          this.board.cols = newBoard.cols;
          this.board.rows = newBoard.rows;
          this.board.title = newBoard.title;
          this.board.lastUpdated = newBoard.lastUpdated;
          // update sidebar data
          this.emitDataToSidenav(this.board);
        }
      });
    }
  }

  // updates the z-index of the note
  public onNoteDragStart(cdkDragStart: CdkDragStart): void {
    const elementRef = cdkDragStart.source.element.nativeElement;
    elementRef.style.setProperty('z-index', '10');
  }

  // moves a note to a proper position after it was released, resets z-index
  public onNoteDrop(cdkDragEnd: CdkDragEnd, note: Note): void {
    const elementRef = cdkDragEnd.source.element.nativeElement;
    // reset z-index
    elementRef.style.setProperty('z-index', '3');
    const curTranslate = getTranslateValues(elementRef);
    // free currently taken note position
    this.boardGrid[note.y][note.x] = 0;
    // get closest free point
    const closestPoint = this.getClosestFreeSlot(note, (note.x * this.NOTE_WIDTH) + curTranslate.x, (note.y * this.NOTE_HEIGHT) + curTranslate.y);
    // set the new position of the note on the board
    this.boardGrid[closestPoint.y][closestPoint.x] = 1;
    // apply new transformation
    note.x = closestPoint.x;
    note.y = closestPoint.y;
    cdkDragEnd.source._dragRef.reset();
    elementRef.style.transform = '';
    // update note data
    this.notesApiService.updateNote(note).subscribe();
  }

  // updates boardGrid with the positions of notes
  public updateBoardAbstractGrid(): void {
    this.boardGrid = [];
    for (let i = 0; i < this.board.rows; ++i) {
      this.boardGrid[i] = [];
      for (let j = 0; j < this.board.cols; ++j) {
        this.boardGrid[i][j] = 0;
      }
    }

    if (this.board.notes) {
      this.board.notes.forEach(note => {
        const i = Math.floor(note.y / this.NOTE_HEIGHT);
        const j = Math.floor(note.x / this.NOTE_WIDTH);
        this.boardGrid[i][j] = 1;
      });
    }
  }

  // returns the closes available position to the given x and y
  public getClosestFreeSlot(note: Note, x: number, y: number): Vector2 {
    // get the closest cells indices
    const closePoints = [];
    closePoints.push(new Vector2(Math.floor(x / this.NOTE_WIDTH) * this.NOTE_WIDTH, Math.floor(y / this.NOTE_HEIGHT) * this.NOTE_HEIGHT));
    closePoints.push(new Vector2((Math.floor(x / this.NOTE_WIDTH) + 1) * this.NOTE_WIDTH, Math.floor(y / this.NOTE_HEIGHT) * this.NOTE_HEIGHT));
    closePoints.push(new Vector2((Math.floor(x / this.NOTE_WIDTH) + 1) * this.NOTE_WIDTH, (Math.floor(y / this.NOTE_HEIGHT) + 1) * this.NOTE_HEIGHT));
    closePoints.push(new Vector2(Math.floor(x / this.NOTE_WIDTH) * this.NOTE_WIDTH, (Math.floor(y / this.NOTE_HEIGHT) + 1) * this.NOTE_HEIGHT));
    let closestPoint = closePoints[0];
    const curentPosition = new Vector2(x, y);
    // find the closest one
    for (const p of closePoints) {
      if (p.distanceTo(curentPosition) < closestPoint.distanceTo(curentPosition)) {
        closestPoint = p;
      }
    }
    // now start BFS from this point to find closest free cell
    const queue = [];
    const used = new Set<Vector2>();
    const adjacents = [];
    // direct border
    adjacents.push(new Vector2(-1, 0));
    adjacents.push(new Vector2(0, -1));
    adjacents.push(new Vector2(0, 1));
    adjacents.push(new Vector2(1, 0));
    // corner border
    adjacents.push(new Vector2(-1, 1));
    adjacents.push(new Vector2(-1, -1));
    adjacents.push(new Vector2(1, 1));
    adjacents.push(new Vector2(1, -1));

    queue.push(new Vector2(closestPoint.x / this.NOTE_WIDTH, closestPoint.y / this.NOTE_HEIGHT));
    while (queue.length) {
      const v = queue.shift();
      // check if point is free, return it
      if (this.boardGrid[v.y][v.x] === 0) {
        return v;
      }
      used.add(v);
      for (const adj of adjacents) {
        const p = adj.add(v);
        if (p.x >= 0 && p.x < this.board.cols && p.y >= 0 && p.y < this.board.rows && this.boardGrid[p.y][p.x] === 0 && !used.has(p)) {
          queue.push(p);
        }
      }
    }
  }

  // generates a correct style to position the note
  public getNoteStyle(note: Note): string {
    return `left:${note.x * this.NOTE_WIDTH}px;top:${note.y * this.NOTE_HEIGHT}px`;
  }

  // generates a correct style to position the slot
  public getSlotStyle(x: number, y: number): string {
    return `left:${x * this.NOTE_WIDTH}px;top:${y * this.NOTE_HEIGHT}px`;
  }

  // opens new-note component in a dialog and passes the position where the note has to be created
  public openNewNoteDialog(x: number, y: number): void {
    const dialogRef = this.dialog.open(NewNoteComponent, {
      data: { mode: State.CREATE, noteData: { position: new Vector2(x, y), boardId: this.board.id } }
    });
    dialogRef.afterClosed().subscribe(note => {
      // receive a new note here and add it to the board
      // data maybe undefined
      if (note) {
        this.board.notes.push(note);
        // update grid
        this.boardGrid[note.y][note.x] = 1;
      }
    });
  }

  public openEditNoteDialog(note: Note): void {
    const dialogRef = this.dialog.open(NewNoteComponent, {
      data: { mode: State.EDIT, noteData: note }
    });
    dialogRef.afterClosed().subscribe(newNote => {
      // receive an updated note here and update it in the board
      // data maybe undefined
      if (newNote) {
        const updateNote = this.board.notes.find(n => n.id === newNote.id);
        if (updateNote) {
          updateNote.content = newNote.content;
          updateNote.color = newNote.color;
        }
      }
    });
  }

  public deleteNote(note: Note): void {
    const reallyWantToDelete = confirm('Delete this note?');
    if (reallyWantToDelete) {
      const indexOfNote = this.board.notes.indexOf(note);
      if (indexOfNote !== -1) {
        this.notesApiService.deleteNote(note.id).subscribe(() => {
          // set 0 to the position of the note
          this.boardGrid[Math.floor(note.y / this.NOTE_HEIGHT)][Math.floor(note.x / this.NOTE_WIDTH)] = 0;
          // remove note from local array
          this.board.notes.splice(indexOfNote, 1);
        });
      }
    }
  }

  public getBoardWidth() {
    if (this.board) {
      return `width:${this.NOTE_WIDTH * this.board.cols}px;height:${this.NOTE_HEIGHT * this.board.rows}px`;
    }
    return '';
  }

  public getBoardWrapperStyle() {
    // if board is wider than 100% of the screen or higher than 100%, set fixed width and height
    if (this.board) {
      return `width: min(100% - 80px, ${this.NOTE_WIDTH * this.board.cols}px); height: min(100% - 100px, ${this.NOTE_HEIGHT * this.board.rows}px)`;
    }
    return '';
  }

  public getNoteCreationDate(note: Note) {
    return new Date(Number(note.creationDate));
  }

  /**
   * Returns translated note text if there is a translation or original note text
   */
  public getNoteContent(note: Note) {
    if (this.notesTranslation && this.notesTranslation[note.id]) {
      return this.notesTranslation[note.id];
    }
    return note.content;
  }

  private getNoteLastUpdated(note: Note): string {
    if (note.lastUpdated) {
      return note.lastUpdated;
    }
    return "0";
  }

  get boardLastUpdated() {
    if (this.board && this.board.lastUpdated) {
      return this.board.lastUpdated;
    }
    return "0";
  }

  /**
   * Sends data used in the sidenav data to the sidenav
   */
  private emitDataToSidenav(board: Board) {
    const sidenavData: BoardData = {
      id: board.id,
      title: board.title,
      creationDate: board.creationDate,
      backgroundImg: board.backgroundImg,
      rows: board.rows,
      cols: board.cols,
      creator: board.creator
    };
    this.boardLoaded.emit(sidenavData);
  }

  /**
   * Updates the map of content of the notes
   */
  private updateOriginalNotesContentMap(board: Board) {
    // create hashtable of notes content in original language
    this.board.notes.forEach(note => {
      this.notesOriginalContent[note.id] = note.content;
    });
  }
}
