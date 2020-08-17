import { Component, OnInit } from '@angular/core';
import { UserService } from '../services/user.service';
import { BoardUsersApiService } from '../services/board-users-api.service';
import { UserWithRole, User } from '../interfaces';
import { Observable, of, forkJoin, from } from 'rxjs';
import { UserRole } from '../models/user-role.enum';
import { take } from 'rxjs/operators';

@Component({
  selector: 'app-user-list',
  templateUrl: './user-list.component.html',
  styleUrls: ['./user-list.component.css']
})
export class UserListComponent implements OnInit {

  public adminView: Boolean = false;
  public usersWithRole: UserWithRole[] = [];
  public currentUser: User;

  constructor(private userService: UserService, private boardUsersService: BoardUsersApiService) { }

  ngOnInit(): void {
    forkJoin(
      this.userService.getUser().pipe(take(1)),
      this.boardUsersService.getBoardUsers('boardKey')
    ).subscribe(([user, users]) => {
      this.currentUser = user;
      this.usersWithRole = users;
      const index = users.findIndex(userWithRole => user.key === userWithRole.user.key && userWithRole.role === UserRole.ADMIN);
      if(index === -1){
        this.adminView = false;
      }else{
        this.adminView = true;
      }
    });
  }
}
