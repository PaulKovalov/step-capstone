// Copyright 2020 Google LLC

import { Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CdkDragEnd, CdkDragStart } from '@angular/cdk/drag-drop';
import { Vector2 } from '../utility/vector';
import { getTranslateValues } from '../utility/util';
import { Board, BoardGridLine, Note, User, UserBoardRole } from '../interfaces';
import { NewNoteComponent } from '../new-note/new-note.component';
import { MatDialog } from '@angular/material/dialog';
import { ActivatedRoute } from '@angular/router';
import { NotesApiService } from '../services/notes-api.service';
import { State } from '../enums/state.enum';
import { LiveUpdatesService } from '../services/live-updates.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BoardUsersApiService } from '../services/board-users-api.service';
import { UserService } from '../services/user.service';
import { UserRole } from '../enums/user-role.enum';
import { SharedBoardService } from '../services/shared-board.service';
import { BoardApiService } from '../services/board-api.service';
import { BoardGridLineType } from '../enums/board-grid-line-type.enum';
import { NewGridLineComponent } from '../new-grid-line/new-grid-line.component';
import { BoardStyles } from '../utility/board-styles';

/**
 * Component for displaying grid and notes
 */
@Component({
  selector: 'app-board',
  templateUrl: './board.component.html',
  styleUrls: ['./board.component.css']
})
export class BoardComponent implements OnInit, OnDestroy {

  private boardGrid: number[][];
  public board: Board;

  // Notes width and height in pixels
  public readonly NOTE_WIDTH = 200;
  public readonly NOTE_HEIGHT = 250;
  private boardRoles: UserBoardRole[] = [];
  private currentUserRole: UserRole = null;
  private currentUser: User = null;
  public boardColumnNames: BoardGridLine[] = [];
  // x coordinates of positions of "add new column" buttons
  public newColumnNameButtonCoordinates: number[] = null;
  private columnsDivRef: ElementRef = null;
  public styler: BoardStyles = null;

  /**
   * Setter of the columns div reference
   */
  @ViewChild('columnsDiv', {read: ElementRef, static: false}) set columnsDivRefSetter(data: any) {
    this.columnsDivRef = data;
  }

  constructor(
    private dialog: MatDialog,
    private activatedRoute: ActivatedRoute,
    private notesApiService: NotesApiService,
    private sharedBoard: SharedBoardService,
    private boardUsersApiService: BoardUsersApiService,
    private liveUpdatesService: LiveUpdatesService,
    private userService: UserService,
    private boardApiService: BoardApiService,
    private snackbar: MatSnackBar) {
  }

  /**
   * Gets the route parameter "id" of the board and fetches the board with this id from the server
   * Creates SidenavBoardData, which is passed to the sidenav to be dispalyed there
   */
  ngOnInit(): void {
    // load board
    this.activatedRoute.paramMap.subscribe(params => {
      const boardId = params.get('id'); // get board id from route param
      // load board with the key
      this.sharedBoard.loadBoard(boardId);
      // subscribe to changes of the board
      this.sharedBoard.boardObservable().subscribe(board => {
        if (board) {
          this.board = board;
          this.updateBoardAbstractGrid();
          this.updateColumnNames();
          // init styler
          this.styler = new BoardStyles(board.cols, board.rows);
          // setup live updates
          if (!this.liveUpdatesService.hasRegisteredBoard()) {
            this.liveUpdatesService.registerBoard(board);
          }
        }
      });
    });

    // fetch board roles, first emitted value is default, second is actual array
    this.boardUsersApiService.getBoardUsersSubject().subscribe(roles => {
      this.boardRoles = roles;
    });

    // fetch current user
    this.userService.getUser().subscribe(user => {
      this.currentUser = user;
    });
  }

  /**
   * Stop live updates and remove board subject
   */
  ngOnDestroy(): void {
    this.liveUpdatesService.unregisterBoard();
    this.sharedBoard.clear();
  }

  /**
   * Updates the z-index of the note
   */
  public onNoteDragStart(cdkDragStart: CdkDragStart): void {
    const elementRef = cdkDragStart.source.element.nativeElement;
    elementRef.style.setProperty('z-index', '10');
  }

  /**
   * Moves a note to a proper position after it was released, resets z-index
   */
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

  /**
   * Updates boardGrid with the positions of notes
   */
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
        const i = note.y;
        const j = note.x;
        this.boardGrid[i][j] = 1;
      });
    }
  }

  /**
   * Generates a list of numbers - x coordinates of the plus buttons,
   * Geenrates a list of column titles from the board entity
   */
  public updateColumnNames(): void {
    // assume each column has a plus button
    this.boardColumnNames = [];
    const coordinates = [];
    for (let i = 0; i < this.board.cols; ++i) {
      coordinates.push(i);
    }
    // next remove buttons that intersect with the taken ranges
    this.board.gridLines.filter(l => l.type === BoardGridLineType.COLUMN).forEach(l => {
      this.boardColumnNames.push(l);
      // remove elements from l.rangeStart to l.rangeEnd
      const idxOfRangeStart = coordinates.indexOf(l.rangeStart);
      if (idxOfRangeStart >= 0) {
        coordinates.splice(idxOfRangeStart, (l.rangeEnd - l.rangeStart));
      }
    });
    this.newColumnNameButtonCoordinates = coordinates;
  }

  /**
   * Returns the closest available position to the given x and y
   */
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

  /**
   * Opens new-note component in a dialog and passes the position where the note has to be created.
   * Dialog sends new note to the board data service
   */
  public openNewNoteDialog(x: number, y: number): void {
    this.dialog.open(NewNoteComponent, {
      data: {mode: State.CREATE, noteData: {position: new Vector2(x, y), boardId: this.board.id}}
    });
  }

  /**
   * Opened dialog sends updated data to the board data service
   */
  public openEditNoteDialog(note: Note): void {
    this.dialog.open(NewNoteComponent, {
      data: {mode: State.EDIT, noteData: note}
    });
  }

  /**
   * Deletes given note. Sends a request to the server and updates shared board
   */
  public deleteNote(note: Note): void {
    const reallyWantToDelete = confirm('Delete this note?');
    if (reallyWantToDelete) {
      this.notesApiService.deleteNote(note.id).subscribe(() => {
        // set 0 to the position of the note
        this.boardGrid[note.y][note.x] = 0;
        // update shared board
        this.sharedBoard.deleteNote(note);
      });
    }
  }

  /**
   * Opens dialog with the NewGridLineComponent inside
   */
  public openNewColumnDialog(rangeStart: number): void {
    this.dialog.open(NewGridLineComponent, {
      data: {boardId: this.board.id, rangeStart: rangeStart, type: BoardGridLineType.COLUMN, mode: State.CREATE}
    });
  }

  /**
   * Deletes a column name
   */
  public deleteColumn(column: BoardGridLine): void {
    // confirm user wants to delete
    const reallyWantToDelete = confirm('Delete column?');
    if (reallyWantToDelete) {
      // make a http delete request, update shared board
      this.boardApiService.deleteBoardGridLine(column).subscribe(() => {
        // successfully deleted
        // update shared board
        this.sharedBoard.deleteGridLine(column);
      }, err => {
        this.snackbar.open('Error occurred when deleting column', 'Ok');
      });
    }
  }

  /**
   * Edits the board grid line. Sends an updated line to the server
   */
  public editBoardGridLine(updatedLine: BoardGridLine): void {
    this.boardApiService.editBoardGridLine(updatedLine).subscribe(line => {
      // success, update shared board
      this.sharedBoard.updateGridLine(line);
    }, err => {
      // some error
      this.snackbar.open('Error occurred', 'Ok');
    });
  }

  /**
   * Opens NewGridLineComponent
   */
  public openEditBoardGridLineDialog(updatedLine: BoardGridLine): void {
    this.dialog.open(NewGridLineComponent, {data: {line: updatedLine, mode: State.EDIT}});
  }

  /**
   * Returns shrinked left column, or same column if shrink is impossible
   */
  public shrinkedLeft(column: BoardGridLine): BoardGridLine {
    // copy all fields of column to a new object
    const newColumn = {...column};
    newColumn.rangeStart = column.rangeStart + 1;
    return newColumn;
  }

  /**
   * Returns shrinked right column, or same column if shrink is impossible
   */
  public shrinkedRight(column: BoardGridLine): BoardGridLine {
    // copy all fields of column to a new object
    const newColumn = {...column};
    newColumn.rangeEnd = column.rangeEnd - 1;
    return newColumn;
  }

  /**
   * Expands the left end of the column 1 unit left if possible
   */
  public expandedLeft(column: BoardGridLine): BoardGridLine {
    // copy all fields of column to a new object
    const newColumn = {...column};
    newColumn.rangeStart = column.rangeStart - 1;
    return newColumn;
  }

  /**
   * Expands the right end of the column 1 unit right if possible
   */
  public expandedRight(column: BoardGridLine): BoardGridLine {
    // copy all fields of column to a new object
    const newColumn = {...column};
    newColumn.rangeEnd = column.rangeEnd + 1;
    return newColumn;
  }

  public getNoteCreationDate(note: Note): Date {
    return new Date(Number(note.creationDate));
  }

  /**
   * Synchronizes scroll values of the board and board header
   */
  public boardScrolled(event: any): void {
    this.columnsDivRef.nativeElement.scrollLeft = event.srcElement.scrollLeft;
  }

  /**
   * Returns true if user can modify note.
   * Returns false otherwise.
   */
  public canModifyNote(note: Note): boolean {
    if (this.currentUser && this.boardRoles) {
      if (!this.currentUserRole) {
        // save user's role if it is not saved yet
        this.currentUserRole = this.boardRoles.find(role => role.user.id === this.currentUser.id).role;
      }
      // if user is owner or admin, return true
      if (this.currentUserRole === 'ADMIN' || this.currentUserRole === 'OWNER') {
        return true;
      }
      // if user is author of the note also return true
      return this.currentUser.id === note.creator.id;
    }
    return false;
  }
}
