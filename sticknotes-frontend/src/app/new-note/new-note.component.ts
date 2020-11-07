// Copyright 2020 Google LLC

import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Vector2 } from '../utility/vector';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { onlySpacesValidator } from '../utility/util';
import { CreateNoteApiData, Note, NotePopupData } from '../interfaces';
import { NotesApiService } from '../services/notes-api.service';
import { State } from '../enums/state.enum';
import { MatSnackBar } from '@angular/material/snack-bar';
import { FileUploadService } from '../services/file-upload.service';
import { SharedBoardService } from '../services/shared-board.service';

@Component({
  selector: 'app-new-note',
  templateUrl: './new-note.component.html',
  styleUrls: ['./new-note.component.css']
})
export class NewNoteComponent {
  // Position of the board in the grid, used in "create" mode
  private position: Vector2;
  // id of the board for which note is created
  private boardId: string;
  // This component can be in 2 states: editing the existing note or creating a new one
  private mode: State;
  // This object stores the note the user edits in the moment
  public editableNote: Note = null;
  // Text displayed in the "submit" button
  public submitButtonText: string;
  // To disable button when the data is being sent to the server
  public sendingData = false;

  // Form used in .html file, has a note content field and colors field
  public newNoteForm = new FormGroup({
    content: new FormControl('', [
      // note must not be empty
      Validators.required,
      // must not be of spaces only
      onlySpacesValidator,
      // must not have content longer than 256 characters
      Validators.maxLength(256) // just random number
    ]),
    // used in a radio buttons group
    // '1' means to select the first radio button as default
    colors: new FormControl('1', [
      // must not be empty
      Validators.required
    ]),
    file: new FormControl({ value: '', disabled: this.editableNote && this.editableNote.image !== null }, [])
  });

  /**
   * Depending on the state, parses the data passed from the caller component in the appropriate way and
   * initializes the component's fields
   */
  constructor(
    @Inject(MAT_DIALOG_DATA) private data: NotePopupData,
    private notesApiService: NotesApiService,
    private dialogRef: MatDialogRef<NewNoteComponent>,
    private snackBar: MatSnackBar,
    private fileUploadService: FileUploadService,
    private sharedBoard: SharedBoardService) {
    if (data.mode === State.CREATE) {
      // creating new note
      const noteData = data.noteData as { position: Vector2, boardId: string };
      this.position = noteData.position;
      this.boardId = noteData.boardId;
      this.mode = State.CREATE;
      this.submitButtonText = 'Create';
    }
    else {
      // editing existing note
      this.editableNote = data.noteData as Note;
      this.newNoteForm.controls.content.setValue(this.editableNote.content);
      this.newNoteForm.controls.colors.setValue(this.getValueByHex(this.editableNote.color));
      this.submitButtonText = 'Update';
      this.mode = State.EDIT;
    }
  }

  /**
   * Creates new note
   */
  private createNote(): void {
    if (this.newNoteForm.valid) {
      // disable button
      this.sendingData = true;
      // construct note payload
      const noteContent = this.newNoteForm.controls.content.value;
      const noteColor = this.getColorHexValue(this.newNoteForm.controls.colors.value);
      const noteData: CreateNoteApiData = {
        x: this.position.x,
        y: this.position.y,
        content: noteContent,
        color: noteColor,
        boardId: this.boardId,
        image: null
      };
      const fileInput = this.newNoteForm.controls.file.value;
      // save image if it is there
      if (fileInput && fileInput.files.length) {
        const snackbarUpload = this.snackBar.open('Uploading image...');
        this.fileUploadService.uploadFile(fileInput.files[0]).subscribe(response => {
          // set attached image url to the payload
          noteData.image = response.fileUrl;
          snackbarUpload.dismiss();
          this.sendNoteCreateData(noteData);
        });
      } else {
        // otherwise just create without image
        this.sendNoteCreateData(noteData);
      }
    }
  }

  /**
   * Updates the note
   */
  private updateNote(): void {
    if (this.newNoteForm.valid) {
      // disable button
      this.sendingData = true;
      // update editableNote object fields
      this.editableNote.content = this.newNoteForm.controls.content.value;
      this.editableNote.color = this.getColorHexValue(this.newNoteForm.controls.colors.value);
      const fileInput = this.newNoteForm.controls.file.value;
      // save image if it is there
      if (fileInput && fileInput.files.length) {
        const snackbarUpload = this.snackBar.open('Uploading image...');
        this.fileUploadService.uploadFile(fileInput.files[0]).subscribe(response => {
          // set attached image url to the payload
          this.editableNote.image = response.fileUrl;
          snackbarUpload.dismiss();
          this.sendNoteUpdateData(this.editableNote);
        });
      } else {
        // otherwise just update without image
        this.sendNoteUpdateData(this.editableNote);
      }
    }
  }

  /**
   * Sends create note payload
   */
  private sendNoteCreateData(payload: CreateNoteApiData): void {
    // service returns a new note object
    this.notesApiService.createNote(payload).subscribe(note => {
      // successfully created, close the dialog and send new note to the shared board service
      this.sharedBoard.newNote(note);
      this.dialogRef.close();
    }, err => {
      // something went wrong
      this.snackBar.open('Server error occurred while creating a note', 'Ok', {
        duration: 2000,
      });
      this.dialogRef.close();
    });
  }

  /**
   * Sends updated note to the server to update note's fields
   */
  private sendNoteUpdateData(payload: Note): void {
    this.notesApiService.updateNote(payload).subscribe(note => {
      // successfully updated, close the dialog and send new note to the shared board service
      this.sharedBoard.updateNote(note);
      this.dialogRef.close();
    }, err => {
      // something went wrong
      this.snackBar.open('Server error occurred while updating a note', 'Ok', {
        duration: 2000,
      });
      this.dialogRef.close();
    });
  }

  public handleSubmit(): void {
    if (this.mode === State.EDIT) {
      this.updateNote();
    } else {
      this.createNote();
    }
  }

  /**
   * Converts radio button value to color hex value
   */
  public getColorHexValue(val: string): string {
    switch (val) {
      case '1': {
        return '#ffff99';
      }
      case '2': {
        return '#ccfff5';
      }
      case '3': {
        return '#ffe6ff';
      } default: {
        return '#e6e6ff';
      }
    }
  }

  /**
   * Converts color hex value to radio button value
   */
  public getValueByHex(color: string): string {
    switch (color) {
      case '#ffff99': {
        return '1';
      }
      case '#ccfff5': {
        return '2';
      }
      case '#ffe6ff': {
        return '3';
      } default: {
        return '4';
      }
    }
  }

  /**
   * Removes image from editableNote.
   * Maybe need to send a request to cloud storage to delete a file indeed
   */
  public removeImage(): void {
    this.editableNote.image = null;
  }
}
