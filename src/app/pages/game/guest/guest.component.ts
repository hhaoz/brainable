import { Component, OnInit } from '@angular/core';
import { Store } from '@ngrx/store';
import { AuthState } from '../../../ngrx/auth/auth.state';
import { QuestionState } from '../../../ngrx/question/question.state';
import { Subscription } from 'rxjs';
import { Question } from '../../../models/question.model';
import { QuestionService } from '../../../services/question/question.service';
import { FormsModule } from '@angular/forms';
import { MaterialModule } from '../../../shared/modules/material.module';
import { WaitingComponent } from './components/waiting/waiting.component';
import { AnswerComponent } from './components/answer/answer.component';
import { ResultComponent } from './components/result/result.component';
import { ActivatedRoute, RouterOutlet } from '@angular/router';
import { GameService } from '../../../services/game/game.service';
import { GameState } from '../../../ngrx/game/game.state';
import * as GameActions from '../../../ngrx/game/game.actions';
import {CountdownToQuestionComponent} from "./components/countdown-to-question/countdown-to-question.component";

@Component({
  selector: 'app-guest',
  standalone: true,
  imports: [
    FormsModule,
    MaterialModule,
    WaitingComponent,
    AnswerComponent,
    ResultComponent,
    CountdownToQuestionComponent,
    RouterOutlet,
  ],
  templateUrl: './guest.component.html',
  styleUrl: './guest.component.scss',
})
export class GuestComponent implements OnInit {
  constructor(
    private activatedRoute: ActivatedRoute,
    private store: Store<{
      question: QuestionState;
      auth: AuthState;
      game: GameState;
    }>,
  ) {}

  ngOnInit(): void {
    const pin = this.activatedRoute.snapshot.paramMap.get('pin');
    this.store.dispatch(GameActions.storePin({ pin }));
  }
}
