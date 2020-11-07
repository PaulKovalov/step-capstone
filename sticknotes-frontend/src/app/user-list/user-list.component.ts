// Copyright 2020 Google LLC

/**
 * This component is displayed on the side bar and contains
 * list of board users
 */
import { Component, OnInit, Input, OnDestroy } from '@angular/core';
import { UserService } from '../services/user.service';
import { BoardUsersApiService } from '../services/board-users-api.service';
import { UserBoardRole, User } from '../interfaces';
import { forkJoin } from 'rxjs';
import { UserRole } from '../enums/user-role.enum';
import { take } from 'rxjs/operators';
import { MatDialog } from '@angular/material/dialog';
import { AddUserComponent } from '../add-user/add-user.component';
import { MatSnackBar } from '@angular/material/snack-bar';
import { EditUserComponent } from '../edit-user/edit-user.component';
import { ActiveUsersApiService } from '../services/active-users-api.service';

@Component({
  selector: 'app-user-list',
  templateUrl: './user-list.component.html',
  styleUrls: ['./user-list.component.css']
})
export class UserListComponent implements OnInit, OnDestroy {
  public usersWithRole: UserBoardRole[] = [];
  public currentUser: User;
  public currentUserRole: UserRole;
  @Input('boardId') public boardId: string;
  public activeUsersIdSet: Set<number> = new Set();
  private intervalId = -1;

  constructor(
    private userService: UserService,
    private boardUsersService: BoardUsersApiService,
    private activeUsersService: ActiveUsersApiService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar) { }

  /**
   * When component is initialized, list of users and current user is fetched from the service.
   * With that two values role of current user is determined.
   */
  ngOnInit(): void {
    forkJoin(
      [
        this.userService.getUser().pipe(take(1)),
        this.boardUsersService.getBoardUsers(this.boardId)
      ]
    ).subscribe(([user, users]) => {
      this.currentUser = user;
      this.usersWithRole = users;
      const index = users.findIndex(userWithRole => user.id === userWithRole.user.id);
      if (index >= 0 && index < users.length) {
        this.currentUserRole = users[index].role;
      } else {
        this.currentUserRole = null;
      }
    });
    this.startFetchingActiveUsers(this.boardId);
  }

  // destroys setInterval
  ngOnDestroy(): void {
    clearInterval(this.intervalId);
  }

  /**
   *
   * @param boardId id of board which function should pass to fetchActiveUsers()
   *
   * Function starts fetching active users list for the given board
   * If the interval is already running, it's id different to -1 than we need to clear
   * it before running another interval
   */
  private startFetchingActiveUsers(boardId: string): void{
    if (this.intervalId != null){
      clearInterval(this.intervalId);
    }
    this.intervalId = setInterval(() => {
      this.fetchActiveUsers(boardId);
    }, 2000);
  }

  /**
   * 
   * @param activeIdSet 
   * with a given activeIdSet returns comparator function that:
   * decides a < b if a is active and b is not active
   * decides b > a if b is active and a is not active
   * decides a == b in any other case
   */
  private compUsers(activeIdSet){
    return function(a, b){
      if (activeIdSet.has(Number(a.id)) && !activeIdSet.has(Number(b.id))) {
        return -1;
      }
      else if (activeIdSet.has(Number(b.id)) && !activeIdSet.has(Number(a.id))) {
        return 1;
      }
      return 0;
    }
  }
  /**
   *
   * @param boardId utilizes activeUsersService to fetch list of active users
   */
  private fetchActiveUsers(boardId: string): void {
    this.activeUsersService.getActiveUsers(boardId).subscribe(activeUsers => {
      this.activeUsersIdSet = new Set(activeUsers.activeUsers);
      this.usersWithRole.sort(this.compUsers(this.activeUsersIdSet));
    });
  }

  /**
   *
   * @param userBoardRole role to edit
   *
   * Based on current user role and the role that user wants to edit, function
   * determines if user is permitted to perform operation of edition.
   */
  canEdit(userBoardRole: UserBoardRole): boolean {
    if (this.currentUser && this.currentUserRole) {
      if (this.currentUserRole === UserRole.OWNER && this.currentUser.id !== userBoardRole.user.id) {
        return true;
      }
      if (this.currentUserRole === UserRole.ADMIN && userBoardRole.role === UserRole.USER) {
        return true;
      }
      return false;
    }
    return false;
  }

  /**
   *
   * @param userBoardRole role to delete
   *
   * Based on current user role and the role that user wants to delete, function
   * determines if user is permitted to perform operation of deletion.
   */
  canDelete(userBoardRole: UserBoardRole): boolean {
    if (this.currentUser && this.currentUserRole) {
      if (this.currentUserRole === UserRole.OWNER && this.currentUser.id !== userBoardRole.user.id) {
        return true;
      }
      if (this.currentUserRole === UserRole.ADMIN && userBoardRole.role === UserRole.USER) {
        return true;
      }
      return false;
    }
    return false;
  }

  /**
   * Function is used to open the dialog for adding user. After dialog is closed
   * function catches data that dialog emits after being closed. The emitted data
   * is newly created user, and this user is added to the list of users.
   */
  openAddUserDialog(): void {
    const dialogRef = this.dialog.open(AddUserComponent, { data: { boardId: this.boardId } });
    dialogRef.afterClosed().subscribe(user => {
      if (user) {
        this.usersWithRole.push(user);
      }
    });
  }

  /**
   *
   * @param userBoardRole role to edit, the parameter is needed to set default
   *                      position of radio button in the edit role dialog.
   *
   * Function is used to open the dialog for editing user. After dialog is closed
   * function catches data that dialog emits after being closed. The emitted data
   * is new role of the user, function updates role of user.
   */
  openEditUserDialog(userBoardRole: UserBoardRole): void {
    if (this.canEdit(userBoardRole)) {
      const dialogRef = this.dialog.open(EditUserComponent, { data: { boardId: this.boardId, role: userBoardRole.role, roleId: userBoardRole.id } });
      dialogRef.afterClosed().subscribe(newRole => {
        if (newRole) {
          userBoardRole.role = newRole; // in case of error newRole is old role
        }
      });
    }
  }

  /**
   *
   * @param userBoardRole role to delete
   *
   * Sends remove request using boardUsersService, if operation was successful
   * also removes role from local list of user roles.
   */
  removeUser(userBoardRole: UserBoardRole, event: Event): void {
    // prevent from opening edit dialog
    event.stopPropagation();
    this.boardUsersService.removeUser(this.boardId, userBoardRole.id).subscribe(() => {
      this.snackBar.open('User removed successfully.', 'Ok', {
        duration: 2000,
      });
      const indexOfRole = this.usersWithRole.indexOf(userBoardRole);
      if (indexOfRole >= 0 && indexOfRole < this.usersWithRole.length) {
        this.usersWithRole.splice(indexOfRole, 1);
      }
    }, err => {
      this.snackBar.open('Error occurred while removing user.', 'Ok', {
        duration: 2000,
      });
    });
  }
}
