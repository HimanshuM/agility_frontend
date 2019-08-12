class AgApplication extends Application {
	constructor() {
		super();
		Http.config.cache = "no-cache";
	}
	init() {
		Routes.draw([
			{path: "/", component: RootComponent},
			{path: "/users/:id", component: UserComponent},
			{path: "/users/:id/courses/:course_id", component: EnrollmentComponent}
		]);
		this.bootstrap(AppComponent);
		this.import(["AgNavbar"]);
	}
}
class AppComponent extends Component {
	templateUrl = "/views/app.html";
	selector = "app-root";
	title = "Agility Frontend Framework!";
	appName = "Batcave";
	constructor() {
		super();
		this.include(NavBarComponent);
	}
}
class NavBarComponent extends Component {
	templateUrl = "/views/common/nav_bar.html";
	selector = "nav-bar";
	test = "Logout";
	constructor() {
		super();
		this.include(AgNavbar);
	}
	print(ev) {
		this.test = "Login";
	}
}
class RootComponent extends Component {
	templateUrl = "/views/root.html";
	course_id = "123";
	course_name = "Lisp";
	courses = ["Lisp", "Steel Bank Lisp", "Scheme", "Common Lisp"];
	index = 0;
	constructor() {
		super();
	}
	laud() {
		this.index++;
		if (this.index > 3) {
			this.course_id = 23456;
			this.index = 0;
		}
		this.course_name = this.courses[this.index];
	}
}
class UserComponent extends Component {
	templateUrl = "/views/user.html";
}
class EnrollmentComponent extends Component {
	templateUrl = "/views/enrollment.html";
}