class AgNavbar extends Component {
	templateUrl = "/js/components/ag_navbar/ag_navbar.html";
	selector = "ag-navbar";
	styleSheets = ["/js/components/ag_navbar/ag_navbar.css"];
	onInit() {
		this.navbar = this.element.find(".ag-navbar")[0];
		for (var e of this.$children) {
			this.navbar.nativeElement.appendChild(e);
		}
	}
}