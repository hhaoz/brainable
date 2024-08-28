import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatDialogContent, MatDialogRef } from '@angular/material/dialog';
import { MatRadioChange } from '@angular/material/radio';
import { Subscription } from 'rxjs';
import { Store } from '@ngrx/store';
import { AuthState } from '../../../../../ngrx/auth/auth.state';
import { QuizState } from '../../../../../ngrx/quiz/quiz.state';
import { Quiz } from '../../../../../models/quiz.model';
import { SharedModule } from '../../../../../shared/modules/shared.module';
import {
  getDownloadURL,
  ref,
  Storage,
  uploadBytesResumable,
} from '@angular/fire/storage';
import * as QuizActions from '../../../../../ngrx/quiz/quiz.actions';
import { MaterialModule } from '../../../../../shared/modules/material.module';
import { Categories } from '../../../../../models/categories.model';
import { CategoriesState } from '../../../../../ngrx/categories/categories.state';
import * as CategoriesActions from '../../../../../ngrx/categories/categories.actions';

@Component({
  selector: 'app-setting-dialog',
  standalone: true,
  imports: [MaterialModule, SharedModule, MatDialogContent],
  templateUrl: './setting-dialog.component.html',
  styleUrl: './setting-dialog.component.scss',
})
export class SettingDialogComponent implements OnInit, OnDestroy {
  quiz!: Quiz;
  listCategories: Categories[] = [];
  isGettingCategories$ = this.store.select(
    'categories',
    'isGetAllCategoriesSuccessful',
  );
  subscription: Subscription[] = [];
  categoryValue: number = 0;

  settings = {
    title: '',
    description: '',
    isPublic: false,
    imgUrl: '',
    category: <Categories>{},
  };

  uploadedFileUrl: string = '';

  constructor(
    private store: Store<{
      auth: AuthState;
      quiz: QuizState;
      categories: CategoriesState;
    }>,
    private storage: Storage,
    private dialogRef: MatDialogRef<SettingDialogComponent>,
  ) {}

  ngOnInit() {
    this.subscription.push(
      this.store.select('quiz', 'quiz').subscribe((quiz) => {
        if (quiz) {
          this.settings.title = quiz.title;
          this.settings.description = quiz.description;
          this.settings.isPublic = quiz.isPublic;
          this.settings.category = quiz.category;
          this.settings.imgUrl = quiz.imgUrl;
        }
      }),
      this.store.select('categories', 'categories').subscribe((categories) => {
        this.listCategories = categories as Categories[];
      }),
      this.store
        .select('categories', 'isGetAllCategoriesSuccessful')
        .subscribe((isGetAllCategoriesSuccessful) => {
          if (isGetAllCategoriesSuccessful) {
            if (this.settings.category) {
              console.log(this.settings.category);
              this.categoryValue = this.listCategories.findIndex(
                (category) => category.uid == this.settings.category.uid,
              );
              console.log(this.categoryValue);
            }
          }
        }),
    );
    this.store.dispatch(CategoriesActions.getAllCategories());
  }

  selectedImage: string | ArrayBuffer = '';

  uploadQuizFile(input: HTMLInputElement) {
    if (!input.files) return;
    const files: FileList = input.files;

    for (let i = 0; i < files.length; i++) {
      const file = files.item(i);
      if (file) {
        const storageRef = ref(this.storage, file.name);
        uploadBytesResumable(storageRef, file)
          .then((snapshot) => {
            getDownloadURL(snapshot.ref)
              .then((url) => {
                this.uploadedFileUrl = url;
                console.log('Uploaded file URL:', this.uploadedFileUrl);
                this.settings.imgUrl = this.uploadedFileUrl;
                this.store.dispatch(
                  QuizActions.updateSetting({
                    setting: { ...this.settings },
                  }),
                );
              })
              .catch((error) => {
                console.error('Error getting file URL:', error);
              });
          })
          .catch((error) => {
            console.error('Error uploading file:', error);
          });
      }
    }
  }

  selectImage(event: any) {
    const fileInput = event.target as HTMLInputElement;
    if (fileInput.files && fileInput.files.length > 0) {
      const file = fileInput.files[0];
      const reader = new FileReader();
      reader.onload = (e) =>
        (this.selectedImage = reader.result as string | ArrayBuffer);
      reader.readAsDataURL(file);
    }
    this.uploadQuizFile(fileInput);
    this.selectedImage = '';
  }

  removeImage() {
    this.uploadedFileUrl = '';
    this.settings.imgUrl = '';
    this.store.dispatch(
      QuizActions.updateSetting({ setting: { ...this.settings } }),
    );
  }

  triggerFileInput(event: any): void {
    event.preventDefault();
    const fileInput = document.getElementById(
      'uploadBtn-quiz',
    ) as HTMLInputElement;
    if (fileInput) {
      fileInput.click();
    }
  }

  closeDialog(): void {
    this.dialogRef.close();
  }

  handleVisibilityChange(event: MatRadioChange): void {
    if (event.value === 'public') {
      this.settings.isPublic = true;
    }
    if (event.value === 'private') {
      this.settings.isPublic = false;
    }
  }

  saveChanges(): void {
    this.store.dispatch(
      QuizActions.updateSetting({ setting: { ...this.settings } }),
    );
  }

  onCategoryChange(event: any) {
    console.log(event);
    this.settings.category = { ...this.listCategories[event.value] };
    this.store.dispatch(
      QuizActions.updateSetting({ setting: { ...this.settings } }),
    );
  }

  ngOnDestroy() {
    this.subscription.forEach((sub) => sub.unsubscribe());
  }
}
